const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");

router.use(authenticate);

// Complaints are a customer-relationship record; reuse the "clients" permission
// module so existing CRM roles can manage them without a new permission key.
const ALLOWED = [
  "subject", "description", "clientId", "clientName", "bookingId",
  "category", "priority", "status", "assignedTo", "resolution", "feedback", "rating",
];
function pick(body) {
  const out = {};
  for (const k of ALLOWED) if (body[k] !== undefined) out[k] = body[k];
  if (out.rating !== undefined && out.rating !== null) out.rating = Number(out.rating) || null;
  return out;
}

async function getOne(id, tenantId) {
  return prisma.complaint.findFirst({ where: { id, tenantId } });
}

router.get("/", requirePermission("clients", "view"), async (req, res) => {
  try {
    const where = { tenantId: req.tenantId };
    if (req.query.status) where.status = String(req.query.status);
    res.json(await prisma.complaint.findMany({ where, orderBy: { createdAt: "desc" } }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/stats", requirePermission("clients", "view"), async (req, res) => {
  try {
    const rows = await prisma.complaint.groupBy({
      by: ["status"], where: { tenantId: req.tenantId }, _count: { _all: true },
    });
    const stats = { open: 0, in_progress: 0, resolved: 0, closed: 0, total: 0 };
    for (const r of rows) { stats[r.status] = r._count._all; stats.total += r._count._all; }
    res.json(stats);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/:id", requirePermission("clients", "view"), async (req, res) => {
  try {
    const item = await getOne(req.params.id, req.tenantId);
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/", requirePermission("clients", "create"), async (req, res) => {
  try {
    const data = pick(req.body);
    if (!data.subject) return res.status(400).json({ message: "Subject is required" });
    const complaint = await prisma.complaint.create({
      data: { ...data, tenantId: req.tenantId, createdBy: req.userId },
    });

    // CRM automation: optionally notify the owner when a complaint is logged.
    const cfg = await prisma.crmConfig.findUnique({ where: { tenantId: req.tenantId } }).catch(() => null);
    if (cfg?.automations?.complaintNotifyOwner) {
      const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId }, select: { ownerId: true } });
      if (tenant?.ownerId) {
        await prisma.notification.create({
          data: {
            tenantId: req.tenantId, userId: tenant.ownerId, actorUserId: req.userId,
            type: "complaint", title: "New complaint logged",
            message: `${complaint.clientName || "A customer"}: ${complaint.subject}`,
            link: "/complaints",
          },
        }).catch((err) => console.error("[automation] complaintNotifyOwner:", err.message));
      }
    }
    res.status(201).json(complaint);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch("/:id", requirePermission("clients", "edit"), async (req, res) => {
  try {
    const existing = await getOne(req.params.id, req.tenantId);
    if (!existing) return res.status(404).json({ message: "Not found" });
    const data = pick(req.body);
    // Stamp resolvedAt when moving into resolved/closed; clear when reopened.
    if (data.status && data.status !== existing.status) {
      if (["resolved", "closed"].includes(data.status) && !existing.resolvedAt) data.resolvedAt = new Date();
      if (["open", "in_progress"].includes(data.status)) data.resolvedAt = null;
    }
    await prisma.complaint.updateMany({ where: { id: req.params.id, tenantId: req.tenantId }, data });
    res.json(await getOne(req.params.id, req.tenantId));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete("/:id", requirePermission("clients", "delete"), async (req, res) => {
  try {
    const result = await prisma.complaint.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
