// Generic CRUD factory for simple resources
const { authenticate, requirePermission, prisma } = require("../middleware/auth");
const router = require("express").Router;

const MODEL_MAP = {
  agent: "agent",
  task: "task",
  payment: "payment",
  transaction: "transaction",
  subscription: "subscription",
  paymentRequest: "paymentRequest",
};

const PERMISSION_MODULE_MAP = {
  agent: "agents",
  task: "tasks",
  payment: "accounts",
  transaction: "accounts",
  subscription: "subscription",
  paymentRequest: "subscription",
};

module.exports = function createCrudRouter(modelKey) {
  const r = router();
  const model = MODEL_MAP[modelKey] || modelKey;
  const permissionModule = PERMISSION_MODULE_MAP[modelKey] || PERMISSION_MODULE_MAP[model] || `${model}s`;

  r.use(authenticate);

  r.get("/", requirePermission(permissionModule, "view"), async (req, res) => {
    try {
      const items = await prisma[model].findMany({
        where: { tenantId: req.tenantId },
        orderBy: { createdAt: "desc" },
      });
      res.json(items);
    } catch (err) { res.status(500).json({ message: err.message }); }
  });

  r.get("/:id", requirePermission(permissionModule, "view"), async (req, res) => {
    try {
      const item = await prisma[model].findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
      });
      if (!item) return res.status(404).json({ message: "Not found" });
      res.json(item);
    } catch (err) { res.status(500).json({ message: err.message }); }
  });

  r.post("/", requirePermission(permissionModule, "create"), async (req, res) => {
    try {
      const item = await prisma[model].create({
        data: { ...req.body, tenantId: req.tenantId },
      });
      res.status(201).json(item);
    } catch (err) { res.status(500).json({ message: err.message }); }
  });

  r.patch("/:id", requirePermission(permissionModule, "edit"), async (req, res) => {
    try {
      const result = await prisma[model].updateMany({
        where: { id: req.params.id, tenantId: req.tenantId },
        data: req.body,
      });
      if (!result.count) return res.status(404).json({ message: "Not found" });
      const updated = await prisma[model].findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
      res.json(updated);
    } catch (err) { res.status(500).json({ message: err.message }); }
  });

  r.delete("/:id", requirePermission(permissionModule, "delete"), async (req, res) => {
    try {
      const result = await prisma[model].deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
      if (!result.count) return res.status(404).json({ message: "Not found" });
      res.json({ success: true });
    } catch (err) { res.status(500).json({ message: err.message }); }
  });

  return r;
};