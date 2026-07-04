const path = require("path");
const fs = require("fs");
const router = require("express").Router();
const { authenticate, requirePermission, checkPlanLimit, prisma } = require("../middleware/auth");
const {
  createClientDocumentsUpload,
  clientDocumentPublicUrl,
  CLIENT_DOC_MAX_FILES,
} = require("../middleware/upload");

router.use(authenticate);

async function getTenantClient(clientId, tenantId, include = undefined) {
  return prisma.client.findFirst({ where: { id: clientId, tenantId }, include });
}

router.get("/", requirePermission("clients", "view"), async (req, res) => {
  try {
    const items = await prisma.client.findMany({ where: { tenantId: req.tenantId }, orderBy: { createdAt: "desc" } });
    res.json(items);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/corporate-summary", requirePermission("clients", "view"), async (req, res) => {
  try {
    const month = String(req.query.month || new Date().toISOString().slice(0, 7));
    const clients = await prisma.client.findMany({
      where: { tenantId: req.tenantId, clientType: "corporate" },
      orderBy: { name: "asc" },
    });
    const clientIds = clients.map((c) => c.id);
    const invoices = clientIds.length
      ? await prisma.invoice.findMany({
          where: { tenantId: req.tenantId, clientId: { in: clientIds } },
        })
      : [];

    const rows = clients.map((client) => {
      const clientInvoices = invoices.filter((i) => i.clientId === client.id);
      const monthInvoices = clientInvoices.filter((i) => {
        const d = i.issuedDate || i.createdAt?.toISOString?.().slice(0, 10) || "";
        return d.startsWith(month);
      });
      const monthTotal = monthInvoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
      const monthPaid = monthInvoices.reduce((s, i) => s + (i.paidAmount || 0), 0);
      const monthDue = monthInvoices.reduce((s, i) => s + (i.dueAmount || 0), 0);
      const openInvoices = clientInvoices.filter((i) => i.status !== "paid" && i.status !== "cancelled").length;
      return {
        clientId: client.id,
        name: client.name,
        companyName: client.companyName || client.name,
        email: client.email,
        phone: client.phone,
        month,
        invoiceCount: monthInvoices.length,
        monthTotal,
        monthPaid,
        monthDue,
        openInvoices,
      };
    });

    res.json({
      month,
      clients: rows,
      totals: {
        clients: rows.length,
        invoiceCount: rows.reduce((s, r) => s + r.invoiceCount, 0),
        monthTotal: rows.reduce((s, r) => s + r.monthTotal, 0),
        monthPaid: rows.reduce((s, r) => s + r.monthPaid, 0),
        monthDue: rows.reduce((s, r) => s + r.monthDue, 0),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Upcoming customer birthdays (by month/day, ignoring year), within N days.
router.get("/birthdays", requirePermission("clients", "view"), async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(String(req.query.days || "30"), 10) || 30, 1), 366);
    const clients = await prisma.client.findMany({
      where: { tenantId: req.tenantId, dateOfBirth: { not: null } },
      select: { id: true, name: true, phone: true, dateOfBirth: true },
    });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const out = [];
    for (const c of clients) {
      const dob = new Date(c.dateOfBirth);
      if (isNaN(dob.getTime())) continue;
      let next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
      if (next < today) next = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate());
      const inDays = Math.round((next - today) / 86400000);
      if (inDays <= days) out.push({ id: c.id, name: c.name, phone: c.phone, date: c.dateOfBirth, inDays });
    }
    out.sort((a, b) => a.inDays - b.inDays);
    res.json(out);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/expiring-passports", requirePermission("clients", "view"), async (req, res) => {
  try {
    const windowDays = Math.min(Math.max(parseInt(String(req.query.days || "30"), 10) || 30, 1), 365);
    const includeExpired = req.query.includeExpired !== "false";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const windowEnd = new Date(today.getTime() + windowDays * 86400000);
    const todayStr = today.toISOString().slice(0, 10);
    const windowEndStr = windowEnd.toISOString().slice(0, 10);

    const clients = await prisma.client.findMany({
      where: { tenantId: req.tenantId, passportExpiry: { not: null } },
      orderBy: { passportExpiry: "asc" },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        passportNumber: true,
        passportExpiry: true,
        nationality: true,
      },
    });

    const items = [];
    let expiring = 0;
    let expired = 0;

    for (const client of clients) {
      const expiry = String(client.passportExpiry || "").slice(0, 10);
      if (!expiry) continue;

      const expiryDate = new Date(expiry);
      expiryDate.setHours(0, 0, 0, 0);
      const daysLeft = Math.round((expiryDate - today) / 86400000);
      const isExpired = expiry < todayStr;
      const isExpiringSoon = !isExpired && expiry <= windowEndStr;

      if (isExpired) {
        expired += 1;
        if (!includeExpired) continue;
      } else if (isExpiringSoon) {
        expiring += 1;
      } else {
        continue;
      }

      items.push({
        ...client,
        daysLeft,
        status: isExpired ? "expired" : "expiring",
      });
    }

    res.json({
      windowDays,
      summary: { expiring, expired, total: items.length },
      items,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", requirePermission("clients", "view"), async (req, res) => {
  try {
    const item = await getTenantClient(req.params.id, req.tenantId, { documents: true });
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/", requirePermission("clients", "create"), checkPlanLimit("clients"), async (req, res) => {
  try {
    const item = await prisma.client.create({ data: { ...req.body, tenantId: req.tenantId } });
    res.status(201).json(item);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch("/:id", requirePermission("clients", "edit"), async (req, res) => {
  try {
    const result = await prisma.client.updateMany({ where: { id: req.params.id, tenantId: req.tenantId }, data: req.body });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    const updated = await prisma.client.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    res.json(updated);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete("/:id", requirePermission("clients", "delete"), async (req, res) => {
  try {
    const result = await prisma.client.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Family members ──────────────────────────────────────────────────────────
router.get("/:id/family", requirePermission("clients", "view"), async (req, res) => {
  try {
    const client = await getTenantClient(req.params.id, req.tenantId);
    if (!client) return res.status(404).json({ message: "Not found" });
    res.json(await prisma.clientFamilyMember.findMany({ where: { clientId: req.params.id }, orderBy: { createdAt: "asc" } }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.post("/:id/family", requirePermission("clients", "edit"), async (req, res) => {
  try {
    const client = await getTenantClient(req.params.id, req.tenantId);
    if (!client) return res.status(404).json({ message: "Not found" });
    const { name, relation, passportNumber, dateOfBirth } = req.body;
    if (!name) return res.status(400).json({ message: "Name is required" });
    res.status(201).json(await prisma.clientFamilyMember.create({
      data: { clientId: req.params.id, tenantId: req.tenantId, name, relation: relation || "family", passportNumber, dateOfBirth },
    }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.delete("/:id/family/:memberId", requirePermission("clients", "edit"), async (req, res) => {
  try {
    const result = await prisma.clientFamilyMember.deleteMany({ where: { id: req.params.memberId, clientId: req.params.id, tenantId: req.tenantId } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Wallet ──────────────────────────────────────────────────────────────────
router.get("/:id/wallet", requirePermission("clients", "view"), async (req, res) => {
  try {
    const client = await getTenantClient(req.params.id, req.tenantId);
    if (!client) return res.status(404).json({ message: "Not found" });
    const transactions = await prisma.walletTransaction.findMany({ where: { clientId: req.params.id }, orderBy: { createdAt: "desc" }, take: 50 });
    res.json({ balance: client.walletBalance || 0, transactions });
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.post("/:id/wallet", requirePermission("clients", "edit"), async (req, res) => {
  try {
    const client = await getTenantClient(req.params.id, req.tenantId);
    if (!client) return res.status(404).json({ message: "Not found" });
    const amount = Math.abs(Number(req.body.amount) || 0);
    const type = req.body.type === "debit" ? "debit" : "credit";
    if (!amount) return res.status(400).json({ message: "Amount is required" });
    const balance = type === "credit" ? (client.walletBalance || 0) + amount : (client.walletBalance || 0) - amount;
    const [, txn] = await prisma.$transaction([
      prisma.client.update({ where: { id: req.params.id }, data: { walletBalance: balance } }),
      prisma.walletTransaction.create({ data: { clientId: req.params.id, tenantId: req.tenantId, type, amount, balance, note: req.body.note, createdBy: req.userId } }),
    ]);
    res.status(201).json({ balance, transaction: txn });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/:id/bookings", requirePermission("clients", "view"), async (req, res) => {
  try {
    const client = await getTenantClient(req.params.id, req.tenantId);
    if (!client) return res.status(404).json({ message: "Not found" });
    const items = await prisma.booking.findMany({ where: { clientId: req.params.id, tenantId: req.tenantId } });
    res.json(items);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/:id/invoices", requirePermission("clients", "view"), async (req, res) => {
  try {
    const client = await getTenantClient(req.params.id, req.tenantId);
    if (!client) return res.status(404).json({ message: "Not found" });
    const items = await prisma.invoice.findMany({ where: { clientId: req.params.id, tenantId: req.tenantId } });
    res.json(items);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/:id/payments", requirePermission("clients", "view"), async (req, res) => {
  try {
    const client = await getTenantClient(req.params.id, req.tenantId);
    if (!client) return res.status(404).json({ message: "Not found" });
    const invoices = await prisma.invoice.findMany({ where: { clientId: req.params.id, tenantId: req.tenantId }, select: { id: true } });
    const ids = invoices.map((i) => i.id);
    const items = ids.length ? await prisma.payment.findMany({ where: { tenantId: req.tenantId, invoiceId: { in: ids } } }) : [];
    res.json(items);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/:id/documents", requirePermission("clients", "view"), async (req, res) => {
  try {
    const client = await getTenantClient(req.params.id, req.tenantId);
    if (!client) return res.status(404).json({ message: "Not found" });
    const items = await prisma.clientDocument.findMany({
      where: { clientId: req.params.id },
      orderBy: { uploadedAt: "desc" },
    });
    res.json(items);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/:id/documents", requirePermission("clients", "edit"), (req, res, next) => {
  const upload = createClientDocumentsUpload(req.params.id);
  upload.array("files", CLIENT_DOC_MAX_FILES)(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message || "Upload failed" });
    next();
  });
}, async (req, res) => {
  try {
    const client = await getTenantClient(req.params.id, req.tenantId);
    if (!client) return res.status(404).json({ message: "Not found" });
    if (!req.files?.length) return res.status(400).json({ message: "No files uploaded" });

    const created = [];
    for (const file of req.files) {
      const doc = await prisma.clientDocument.create({
        data: {
          clientId: req.params.id,
          name: file.originalname,
          type: file.mimetype,
          url: clientDocumentPublicUrl(req.params.id, file.filename),
        },
      });
      created.push(doc);
    }
    res.status(201).json(created.length === 1 ? created[0] : created);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete("/:id/documents/:docId", requirePermission("clients", "edit"), async (req, res) => {
  try {
    const client = await getTenantClient(req.params.id, req.tenantId);
    if (!client) return res.status(404).json({ message: "Not found" });

    const doc = await prisma.clientDocument.findFirst({
      where: { id: req.params.docId, clientId: req.params.id },
    });
    if (!doc) return res.status(404).json({ message: "Not found" });

    const uploadRoot = process.env.UPLOAD_DIR || path.join(__dirname, "../../uploads");
    const relative = doc.url.replace(/^\/uploads\//, "");
    const filePath = path.join(uploadRoot, relative);
    await prisma.clientDocument.delete({ where: { id: doc.id } });
    fs.unlink(filePath, () => {});

    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;