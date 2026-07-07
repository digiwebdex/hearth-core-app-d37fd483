const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");
const acc = require("../services/accountingService");

router.use(authenticate);

async function getTenantExpense(id, tenantId) {
  return prisma.expense.findFirst({ where: { id, tenantId } });
}

async function syncExpenseTransaction(expense) {
  const existing = await prisma.transaction.findFirst({
    where: { tenantId: expense.tenantId, referenceType: "expense", referenceId: expense.id },
  });

  if (expense.status !== "approved") {
    if (existing) {
      await prisma.transaction.update({ where: { id: existing.id }, data: { status: "cancelled" } }).catch(() => {});
    }
    return;
  }

  const payload = {
    accountId: expense.accountId || null,
    type: "expense",
    category: String(expense.category || "expense"),
    description: expense.description,
    amount: expense.amount,
    referenceId: expense.id,
    referenceType: "expense",
    vendorId: expense.vendorId || null,
    paymentMethod: expense.paymentMethod,
    status: "completed",
    date: expense.date,
    tenantId: expense.tenantId,
    createdBy: expense.createdBy || null,
  };

  if (existing) {
    await prisma.transaction.update({ where: { id: existing.id }, data: payload }).catch(() => {});
  } else {
    await prisma.transaction.create({ data: payload }).catch(() => {});
  }

  // Double-entry journal: post when approved, reverse when it leaves approved.
  try {
    if (expense.status === "approved") {
      await acc.postExpense(expense.tenantId, expense, { createdBy: expense.createdBy });
    } else {
      await acc.reverseEntry(expense.tenantId, "expense", expense.id, { createdBy: expense.createdBy });
    }
  } catch (e) { console.error("[accounting] expense:", e.message); }
}

router.get("/", requirePermission("accounts", "view"), async (req, res) => {
  try { res.json(await prisma.expense.findMany({ where: { tenantId: req.tenantId }, orderBy: { createdAt: "desc" } })); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.get("/:id", requirePermission("accounts", "view"), async (req, res) => {
  try {
    const e = await getTenantExpense(req.params.id, req.tenantId);
    if (!e) return res.status(404).json({ message: "Not found" });
    res.json(e);
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.post("/", requirePermission("accounts", "create"), async (req, res) => {
  try {
    const expense = await prisma.expense.create({ data: { ...req.body, createdBy: req.userId, tenantId: req.tenantId } });
    await syncExpenseTransaction(expense);
    res.status(201).json(expense);
  }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.patch("/:id", requirePermission("accounts", "edit"), async (req, res) => {
  try {
    const result = await prisma.expense.updateMany({ where: { id: req.params.id, tenantId: req.tenantId }, data: req.body });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    const updated = await prisma.expense.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    await syncExpenseTransaction(updated);
    res.json(updated);
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.delete("/:id", requirePermission("accounts", "delete"), async (req, res) => {
  try {
    const expense = await getTenantExpense(req.params.id, req.tenantId);
    if (!expense) return res.status(404).json({ message: "Not found" });
    await prisma.transaction.deleteMany({ where: { tenantId: req.tenantId, referenceType: "expense", referenceId: expense.id } }).catch(() => {});
    await acc.reverseEntry(req.tenantId, "expense", expense.id, { createdBy: req.userId }).catch((e) => console.error("[accounting] reverse expense:", e.message));
    await prisma.expense.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
    res.json({ success: true });
  }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.post("/:id/approve", requirePermission("accounts", "edit"), async (req, res) => {
  try {
    const result = await prisma.expense.updateMany({ where: { id: req.params.id, tenantId: req.tenantId }, data: { status: "approved", approvedBy: req.userId } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    const updated = await prisma.expense.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    await syncExpenseTransaction(updated);
    res.json(updated);
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.post("/:id/reject", requirePermission("accounts", "edit"), async (req, res) => {
  try {
    const result = await prisma.expense.updateMany({ where: { id: req.params.id, tenantId: req.tenantId }, data: { status: "rejected" } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    const updated = await prisma.expense.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    await syncExpenseTransaction(updated);
    res.json(updated);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;