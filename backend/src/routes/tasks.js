// Tasks — CRM-aware task list.
//
// Supersedes the generic crud("task") mount. Preserves the exact CRUD contract the
// existing Tasks page relies on (GET / , GET /:id , POST / , PATCH /:id , DELETE /:id)
// and adds: optional linkage to any CRM record (relatedType/relatedId), server-set
// createdBy, and list filtering (relatedType/relatedId/status/assignedTo). Every
// query is tenant-scoped; writes/deletes use updateMany/deleteMany on {id, tenantId}.

const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");

router.use(authenticate);

const RELATED_TYPES = ["client", "corporate", "lead", "booking", "vendor", "agent", "invoice", "quotation"];
const STATUSES = ["todo", "in_progress", "done", "cancelled"];
const PRIORITIES = ["low", "medium", "high", "urgent"];

function normalizeRelatedType(value) {
  if (value === null || value === "") return null;
  const v = String(value || "").trim().toLowerCase();
  return RELATED_TYPES.includes(v) ? v : null;
}

function buildTaskData(body, { creating } = {}) {
  const data = {};
  if (body.title !== undefined) data.title = String(body.title || "").trim();
  if (body.description !== undefined) data.description = String(body.description || "");
  if (body.status !== undefined) {
    const s = String(body.status).trim().toLowerCase();
    data.status = STATUSES.includes(s) ? s : "todo";
  }
  if (body.priority !== undefined) {
    const p = String(body.priority).trim().toLowerCase();
    data.priority = PRIORITIES.includes(p) ? p : "medium";
  }
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? String(body.dueDate) : null;
  if (body.assignedTo !== undefined) data.assignedTo = body.assignedTo ? String(body.assignedTo) : null;
  if (body.relatedType !== undefined) data.relatedType = normalizeRelatedType(body.relatedType);
  if (body.relatedId !== undefined) data.relatedId = body.relatedId ? String(body.relatedId) : null;
  // Keep relatedType/relatedId consistent: a link needs both.
  if (creating && (data.relatedType == null || data.relatedId == null)) {
    data.relatedType = data.relatedType ?? null;
    data.relatedId = data.relatedId ?? null;
  }
  return data;
}

router.get("/", requirePermission("tasks", "view"), async (req, res) => {
  try {
    const where = { tenantId: req.tenantId };
    if (req.query.relatedType) where.relatedType = normalizeRelatedType(req.query.relatedType);
    if (req.query.relatedId) where.relatedId = String(req.query.relatedId);
    if (req.query.status) where.status = String(req.query.status).toLowerCase();
    if (req.query.assignedTo) where.assignedTo = String(req.query.assignedTo);
    const items = await prisma.task.findMany({ where, orderBy: { createdAt: "desc" } });
    res.json(items);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/:id", requirePermission("tasks", "view"), async (req, res) => {
  try {
    const item = await prisma.task.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/", requirePermission("tasks", "create"), async (req, res) => {
  try {
    const data = buildTaskData(req.body, { creating: true });
    if (!data.title) return res.status(400).json({ message: "Task title is required" });
    const item = await prisma.task.create({
      data: { ...data, tenantId: req.tenantId, createdBy: req.userId || null },
    });
    res.status(201).json(item);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch("/:id", requirePermission("tasks", "edit"), async (req, res) => {
  try {
    const data = buildTaskData(req.body, { creating: false });
    const result = await prisma.task.updateMany({ where: { id: req.params.id, tenantId: req.tenantId }, data });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    const updated = await prisma.task.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    res.json(updated);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete("/:id", requirePermission("tasks", "delete"), async (req, res) => {
  try {
    const result = await prisma.task.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
module.exports.RELATED_TYPES = RELATED_TYPES;
