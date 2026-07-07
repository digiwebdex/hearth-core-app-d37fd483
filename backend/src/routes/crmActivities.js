// CRM Activities & Notes — entity-agnostic interaction timeline.
//
// One route backs BOTH the "Notes" and "Activities" CRM features. A note is just
// an activity of type "note"; calls/emails/meetings/etc. are the logged activities.
// The store is the `CrmActivity` model (mirrors the Document engine's
// {tenantId, entityType, entityId} shape) so a single surface serves clients,
// corporate clients, vendors/suppliers and agents without a per-entity table.
//
// Tenant isolation: every read filters by req.tenantId; writes/deletes go through
// updateMany/deleteMany on {id, tenantId} → 404 on miss (never a bare update).
// RBAC: gated on the CRM anchor module `clients` (same precedent as crmEngine /
// crmAnalytics / crmSettings), which every CRM-facing role can at least view.

const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");

router.use(authenticate);

const ENTITY_TYPES = ["client", "corporate", "vendor", "agent", "lead"];
const ACTIVITY_TYPES = [
  "note", "call", "email", "meeting", "whatsapp", "sms", "visit", "task", "status_change", "other",
];

function normalizeEntityType(value) {
  const v = String(value || "").trim().toLowerCase();
  return ENTITY_TYPES.includes(v) ? v : null;
}

function normalizeType(value) {
  const v = String(value || "note").trim().toLowerCase();
  return ACTIVITY_TYPES.includes(v) ? v : "note";
}

function parseDueAt(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// GET /  — list a record's timeline. Requires entityType+entityId; optional type filter.
router.get("/", requirePermission("clients", "view"), async (req, res) => {
  try {
    const entityType = normalizeEntityType(req.query.entityType);
    const entityId = req.query.entityId ? String(req.query.entityId) : null;
    if (!entityType || !entityId) {
      return res.status(400).json({ message: "entityType and entityId are required" });
    }
    const where = { tenantId: req.tenantId, entityType, entityId };
    if (req.query.type) where.type = normalizeType(req.query.type);
    const items = await prisma.crmActivity.findMany({
      where,
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: Math.min(Number(req.query.limit) || 200, 500),
    });
    res.json(items);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /due  — upcoming/overdue follow-ups across the tenant (activities with a dueAt).
router.get("/due", requirePermission("clients", "view"), async (req, res) => {
  try {
    const items = await prisma.crmActivity.findMany({
      where: { tenantId: req.tenantId, dueAt: { not: null } },
      orderBy: { dueAt: "asc" },
      take: Math.min(Number(req.query.limit) || 100, 200),
    });
    res.json(items);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/", requirePermission("clients", "create"), async (req, res) => {
  try {
    const entityType = normalizeEntityType(req.body.entityType);
    const entityId = req.body.entityId ? String(req.body.entityId) : null;
    if (!entityType || !entityId) {
      return res.status(400).json({ message: "entityType and entityId are required" });
    }
    const body = String(req.body.body || "").trim();
    const title = req.body.title ? String(req.body.title).trim() : null;
    if (!body && !title) return res.status(400).json({ message: "A note/activity body is required" });

    const item = await prisma.crmActivity.create({
      data: {
        tenantId: req.tenantId,
        entityType,
        entityId,
        type: normalizeType(req.body.type),
        title,
        body,
        outcome: req.body.outcome ? String(req.body.outcome) : null,
        dueAt: parseDueAt(req.body.dueAt),
        pinned: !!req.body.pinned,
        metadata: req.body.metadata ?? null,
        createdBy: req.userId || null,
      },
    });
    res.status(201).json(item);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch("/:id", requirePermission("clients", "edit"), async (req, res) => {
  try {
    const data = {};
    if (req.body.type !== undefined) data.type = normalizeType(req.body.type);
    if (req.body.title !== undefined) data.title = req.body.title ? String(req.body.title).trim() : null;
    if (req.body.body !== undefined) data.body = String(req.body.body || "").trim();
    if (req.body.outcome !== undefined) data.outcome = req.body.outcome ? String(req.body.outcome) : null;
    if (req.body.dueAt !== undefined) data.dueAt = parseDueAt(req.body.dueAt);
    if (req.body.pinned !== undefined) data.pinned = !!req.body.pinned;
    if (req.body.metadata !== undefined) data.metadata = req.body.metadata ?? null;

    const result = await prisma.crmActivity.updateMany({
      where: { id: req.params.id, tenantId: req.tenantId },
      data,
    });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    const updated = await prisma.crmActivity.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    res.json(updated);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete("/:id", requirePermission("clients", "delete"), async (req, res) => {
  try {
    const result = await prisma.crmActivity.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
module.exports.ENTITY_TYPES = ENTITY_TYPES;
module.exports.ACTIVITY_TYPES = ACTIVITY_TYPES;
