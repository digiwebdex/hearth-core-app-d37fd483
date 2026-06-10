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