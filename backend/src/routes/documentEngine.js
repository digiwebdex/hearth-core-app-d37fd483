// Shared Document Engine API — one document system for every module.
// (docs/v2-master/11-Architecture-Freeze.md, docs/v2-master/12-Implementation-Sequence.md).
//
// Mounted at /api/document-engine (the existing /api/documents "documents
// hub" is a different, unchanged read-only aggregator). Every module — any
// booking type, customer, supplier, invoice, employee — attaches documents
// through this one engine, on the new entity-agnostic Document model.
//
// No duplicate upload logic: reuses the exact multer `upload` instance
// exported by routes/bookings.js (the same one airTicketBookings.js and
// visaBookings.js use) — same dest, 10 MB limit, and MIME allow-list.
// Document permissions reuse the Permission Engine: each entity type maps to
// an existing RBAC module, and access is checked with that module's role
// matrix. Verification status is resolved through the Status Engine
// (documentVerificationStatus set). The existing BookingDocument/
// ClientDocument tables and their routes are untouched.

const crypto = require("crypto");
const router = require("express").Router();
const { authenticate, prisma } = require("../middleware/auth");
const { upload } = require("./bookings");
const { resolveRole, hasPermission } = require("../lib/permissionEngine");
const { resolveStatus } = require("../lib/statusEngine");
const {
  getDocumentRegistry,
  isSupportedEntityType,
  getEntityRbacModule,
  validateDocumentInput,
  nextVersionNumber,
  buildVersionEntry,
  appendHistory,
  buildShareEntry,
  revokeShare,
  isExpired,
  isExpiringWithin,
  VERIFICATION_STATUS_SET_ID,
} = require("../lib/documentRegistry");

router.use(authenticate);

function nowIso() {
  return new Date().toISOString();
}

/** Entity-aware permission check, reusing the Permission Engine's role matrix. */
function canAccess(req, entityType, action) {
  const module = getEntityRbacModule(entityType);
  if (!module) return false;
  return hasPermission(resolveRole(req.userRole).canonicalRole, module, action);
}

function parseTags(raw) {
  if (Array.isArray(raw)) return raw.map((t) => String(t).trim()).filter(Boolean);
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((t) => String(t).trim()).filter(Boolean);
    } catch {
      return raw.split(",").map((t) => t.trim()).filter(Boolean);
    }
  }
  return [];
}

function serializeDocument(doc) {
  return { ...doc, verificationContext: resolveStatus(VERIFICATION_STATUS_SET_ID, doc.verificationStatus) };
}

async function getTenantDocument(id, tenantId) {
  return prisma.document.findFirst({ where: { id, tenantId } });
}

// ── Document Registry (metadata; no tenant data) ──
router.get("/registry", (_req, res) => {
  res.json(getDocumentRegistry());
});

// ── Document Expiry (cross-entity; filtered to what the caller may view) ──
router.get("/expiring", async (req, res) => {
  try {
    const daysRaw = parseInt(String(req.query.days || "30"), 10);
    const days = Number.isFinite(daysRaw) ? Math.min(Math.max(daysRaw, 1), 365) : 30;
    const asOf = nowIso();
    const horizon = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const docs = await prisma.document.findMany({
      where: { tenantId: req.tenantId, expiryDate: { not: null, lte: horizon } },
      orderBy: { expiryDate: "asc" },
    });

    const visible = docs
      .filter((d) => canAccess(req, d.entityType, "view"))
      .map((d) => ({
        ...serializeDocument(d),
        expired: isExpired(d.expiryDate, asOf),
        expiringSoon: isExpiringWithin(d.expiryDate, asOf, days),
      }));

    res.json({ asOf, windowDays: days, documents: visible });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Single-document operations (declared before /:entityType/:entityId) ──
router.get("/doc/:documentId", async (req, res) => {
  try {
    const doc = await getTenantDocument(req.params.documentId, req.tenantId);
    if (!doc) return res.status(404).json({ message: "Document not found" });
    if (!canAccess(req, doc.entityType, "view")) return res.status(403).json({ message: "Forbidden" });
    res.json(serializeDocument(doc));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/doc/:documentId", async (req, res) => {
  try {
    const doc = await getTenantDocument(req.params.documentId, req.tenantId);
    if (!doc) return res.status(404).json({ message: "Document not found" });
    if (!canAccess(req, doc.entityType, "edit")) return res.status(403).json({ message: "Forbidden" });

    const patch = {};
    if (req.body.title !== undefined) patch.title = req.body.title;
    if (req.body.category !== undefined) patch.category = req.body.category;
    if (req.body.tags !== undefined) patch.tags = parseTags(req.body.tags);
    if (req.body.expiryDate !== undefined) patch.expiryDate = req.body.expiryDate;

    const validation = validateDocumentInput({ title: patch.title ?? doc.title, ...patch }, { requireEntity: false });
    if (!validation.valid) return res.status(400).json({ message: "Validation failed", errors: validation.errors });

    const data = {
      ...(patch.title !== undefined ? { title: String(patch.title).trim() } : {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
      ...(patch.expiryDate !== undefined ? { expiryDate: patch.expiryDate ? new Date(patch.expiryDate) : null } : {}),
      history: appendHistory(doc.history, { action: "updated", actorId: req.userId, detail: "metadata updated", at: nowIso() }),
    };
    const updated = await prisma.document.update({ where: { id: doc.id }, data });
    res.json(serializeDocument(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/doc/:documentId", async (req, res) => {
  try {
    const doc = await getTenantDocument(req.params.documentId, req.tenantId);
    if (!doc) return res.status(404).json({ message: "Document not found" });
    if (!canAccess(req, doc.entityType, "delete")) return res.status(403).json({ message: "Forbidden" });
    await prisma.document.delete({ where: { id: doc.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Document Versioning ──
router.post("/doc/:documentId/versions", upload.single("file"), async (req, res) => {
  try {
    const doc = await getTenantDocument(req.params.documentId, req.tenantId);
    if (!doc) return res.status(404).json({ message: "Document not found" });
    if (!canAccess(req, doc.entityType, "edit")) return res.status(403).json({ message: "Forbidden" });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const versionNumber = nextVersionNumber(doc);
    const entry = buildVersionEntry({
      versionNumber,
      fileName: req.file.originalname,
      url: `/uploads/${req.file.filename}`,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: req.userId,
      uploadedAt: nowIso(),
    });

    const updated = await prisma.document.update({
      where: { id: doc.id },
      data: {
        currentVersion: versionNumber,
        versions: [...(Array.isArray(doc.versions) ? doc.versions : []), entry],
        history: appendHistory(doc.history, { action: "version_uploaded", actorId: req.userId, detail: `v${versionNumber}`, at: nowIso() }),
      },
    });
    res.status(201).json(serializeDocument(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Document Verification (resolved through the Status Engine) ──
router.post("/doc/:documentId/verify", async (req, res) => {
  try {
    const doc = await getTenantDocument(req.params.documentId, req.tenantId);
    if (!doc) return res.status(404).json({ message: "Document not found" });
    if (!canAccess(req, doc.entityType, "edit")) return res.status(403).json({ message: "Forbidden" });

    const status = String(req.body.status || "").trim();
    if (!resolveStatus(VERIFICATION_STATUS_SET_ID, status).known) {
      return res.status(400).json({ message: "status must be a valid document verification status (unverified, verified, rejected)" });
    }

    const isFinalized = status === "verified" || status === "rejected";
    const updated = await prisma.document.update({
      where: { id: doc.id },
      data: {
        verificationStatus: status,
        verifiedBy: isFinalized ? req.userId : null,
        verifiedAt: isFinalized ? new Date() : null,
        history: appendHistory(doc.history, { action: `verification_${status}`, actorId: req.userId, detail: req.body.note || null, at: nowIso() }),
      },
    });
    res.json(serializeDocument(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Document Sharing ──
router.get("/doc/:documentId/history", async (req, res) => {
  try {
    const doc = await getTenantDocument(req.params.documentId, req.tenantId);
    if (!doc) return res.status(404).json({ message: "Document not found" });
    if (!canAccess(req, doc.entityType, "view")) return res.status(403).json({ message: "Forbidden" });
    res.json(Array.isArray(doc.history) ? doc.history : []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/doc/:documentId/shares", async (req, res) => {
  try {
    const doc = await getTenantDocument(req.params.documentId, req.tenantId);
    if (!doc) return res.status(404).json({ message: "Document not found" });
    if (!canAccess(req, doc.entityType, "edit")) return res.status(403).json({ message: "Forbidden" });

    const share = buildShareEntry({
      id: crypto.randomUUID(),
      sharedWith: req.body.sharedWith,
      note: req.body.note,
      expiresAt: req.body.expiresAt || null,
      createdBy: req.userId,
      createdAt: nowIso(),
    });

    const updated = await prisma.document.update({
      where: { id: doc.id },
      data: {
        shares: [...(Array.isArray(doc.shares) ? doc.shares : []), share],
        history: appendHistory(doc.history, { action: "shared", actorId: req.userId, detail: share.sharedWith, at: nowIso() }),
      },
    });
    res.status(201).json(serializeDocument(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/doc/:documentId/shares/:shareId", async (req, res) => {
  try {
    const doc = await getTenantDocument(req.params.documentId, req.tenantId);
    if (!doc) return res.status(404).json({ message: "Document not found" });
    if (!canAccess(req, doc.entityType, "edit")) return res.status(403).json({ message: "Forbidden" });

    const nextShares = revokeShare(doc.shares, req.params.shareId);
    const updated = await prisma.document.update({
      where: { id: doc.id },
      data: {
        shares: nextShares,
        history: appendHistory(doc.history, { action: "share_revoked", actorId: req.userId, detail: req.params.shareId, at: nowIso() }),
      },
    });
    res.json(serializeDocument(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Entity-scoped list + create (declared LAST so the fixed routes above win) ──
router.get("/:entityType/:entityId", async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    if (!isSupportedEntityType(entityType)) return res.status(400).json({ message: `Unsupported entity type: ${entityType}` });
    if (!canAccess(req, entityType, "view")) return res.status(403).json({ message: "Forbidden" });

    const docs = await prisma.document.findMany({
      where: { tenantId: req.tenantId, entityType, entityId },
      orderBy: { createdAt: "desc" },
    });
    res.json(docs.map(serializeDocument));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Document Upload — create a document with its first version.
router.post("/:entityType/:entityId", upload.single("file"), async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const validation = validateDocumentInput({ ...req.body, entityType, entityId });
    if (!validation.valid) return res.status(400).json({ message: "Validation failed", errors: validation.errors });
    if (!canAccess(req, entityType, "create")) return res.status(403).json({ message: "Forbidden" });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const version = buildVersionEntry({
      versionNumber: 1,
      fileName: req.file.originalname,
      url: `/uploads/${req.file.filename}`,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: req.userId,
      uploadedAt: nowIso(),
    });

    const created = await prisma.document.create({
      data: {
        tenantId: req.tenantId,
        entityType,
        entityId,
        category: req.body.category || "other",
        title: String(req.body.title).trim(),
        tags: parseTags(req.body.tags),
        expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : null,
        currentVersion: 1,
        versions: [version],
        shares: [],
        history: appendHistory([], { action: "created", actorId: req.userId, detail: "v1 uploaded", at: nowIso() }),
        createdBy: req.userId,
      },
    });
    res.status(201).json(serializeDocument(created));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
