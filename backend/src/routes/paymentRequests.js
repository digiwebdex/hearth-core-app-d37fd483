// Dedicated payment-request route with strict tenant isolation
const router = require("express").Router();
const { authenticate, requireRole, prisma } = require("../middleware/auth");

router.use(authenticate);

const DEFAULT_PAYMENT_METHODS = [
  { methodCode: "bkash", label: "bKash", enabled: true, accountName: process.env.BKASH_ACCOUNT_NAME || null, accountNumber: process.env.BKASH_ACCOUNT_NUMBER || null, bankName: null, branchName: null, instructions: process.env.BKASH_INSTRUCTIONS || "Send money from your bKash account and submit the transaction ID.", sortOrder: 1 },
  { methodCode: "nagad", label: "Nagad", enabled: true, accountName: process.env.NAGAD_ACCOUNT_NAME || null, accountNumber: process.env.NAGAD_ACCOUNT_NUMBER || null, bankName: null, branchName: null, instructions: process.env.NAGAD_INSTRUCTIONS || "Send money from your Nagad account and submit the transaction ID.", sortOrder: 2 },
  { methodCode: "rocket", label: "Rocket", enabled: true, accountName: process.env.ROCKET_ACCOUNT_NAME || null, accountNumber: process.env.ROCKET_ACCOUNT_NUMBER || null, bankName: null, branchName: null, instructions: process.env.ROCKET_INSTRUCTIONS || "Send money from your Rocket account and submit the transaction ID.", sortOrder: 3 },
  { methodCode: "bank_transfer", label: "Bank Transfer", enabled: true, accountName: process.env.BANK_ACCOUNT_NAME || null, accountNumber: process.env.BANK_ACCOUNT_NUMBER || null, bankName: process.env.BANK_NAME || null, branchName: process.env.BANK_BRANCH || null, instructions: process.env.BANK_TRANSFER_INSTRUCTIONS || "Transfer the amount to the bank account and submit the transfer reference.", sortOrder: 4 },
];

const PENDING_REVIEW_STATUSES = ["pending", "submitted", "pending_review", "needs_info"];

function normalizePlan(plan) {
  return String(plan || "free").trim().toLowerCase();
}

function normalizeBillingCycle(cycle) {
  return String(cycle || "monthly").trim().toLowerCase() === "yearly" ? "yearly" : "monthly";
}

function normalizeStatus(status) {
  const value = String(status || "pending").trim().toLowerCase();
  if (["submitted", "pending_review"].includes(value)) return "pending";
  if (value === "request_more_info") return "needs_info";
  return value || "pending";
}

function resolveRequestType({ currentPlan, requestedPlan, subscriptionStatus, explicitRequestType }) {
  const explicit = String(explicitRequestType || "").trim().toLowerCase();
  if (["activate", "renew", "upgrade", "downgrade"].includes(explicit)) return explicit;
  const current = normalizePlan(currentPlan);
  const requested = normalizePlan(requestedPlan);
  if (!current || current === "free" || subscriptionStatus === "trial" || subscriptionStatus === "expired") return "activate";
  if (current === requested) return "renew";
  return "upgrade";
}

async function getEnabledPaymentMethods() {
  if (!prisma.paymentMethodConfig) return DEFAULT_PAYMENT_METHODS;
  let rows = await prisma.paymentMethodConfig.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } });
  if (!rows.length) {
    await prisma.paymentMethodConfig.createMany({ data: DEFAULT_PAYMENT_METHODS }).catch(() => {});
    rows = await prisma.paymentMethodConfig.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } });
  }
  return rows;
}

async function writeAuditLog(req, { action, targetId, targetLabel, newValue, oldValue, metadata }) {
  const [user, tenant] = await Promise.all([
    prisma.user.findUnique({ where: { id: req.userId }, select: { name: true, email: true, role: true } }),
    prisma.tenant.findUnique({ where: { id: req.tenantId }, select: { name: true } }),
  ]);
  await prisma.auditLog.create({
    data: {
      actorId: req.userId,
      actorName: user?.name || "",
      actorEmail: user?.email || "",
      actorRole: user?.role || req.userRole || "",
      tenantId: req.tenantId,
      tenantName: tenant?.name || null,
      module: "subscription",
      action,
      targetType: "paymentRequest",
      targetId,
      targetLabel,
      oldValue: oldValue ? JSON.stringify(oldValue) : null,
      newValue: newValue ? JSON.stringify(newValue) : null,
      metadata: metadata || undefined,
    },
  }).catch(() => {});
}

async function buildPaymentRequestInput(req, body, tenant) {
  const requestedPlan = normalizePlan(body.requestedPlan || body.plan);
  if (!requestedPlan) throw new Error("requestedPlan or plan is required");

  const amountSent = Number(body.amountSent ?? body.amount ?? 0);
  if (!Number.isFinite(amountSent) || amountSent <= 0) throw new Error("A valid amountSent is required");

  const paymentMethod = String(body.paymentMethod || body.method || "manual").trim().toLowerCase();
  const transactionId = String(body.transactionId || body.trxId || "").trim();
  if (["bkash", "nagad", "rocket", "bank_transfer"].includes(paymentMethod) && !transactionId) throw new Error("Transaction ID / reference is required");

  const currentPlan = normalizePlan(body.currentPlan || tenant.subscriptionPlan || "free");
  const billingCycle = normalizeBillingCycle(body.billingCycle);
  const requestType = resolveRequestType({ currentPlan, requestedPlan, subscriptionStatus: tenant.subscriptionStatus, explicitRequestType: body.requestType });

  if (transactionId) {
    const dup = await prisma.paymentRequest.findFirst({
      where: {
        tenantId: req.tenantId,
        id: body.id ? { not: body.id } : undefined,
        OR: [{ trxId: transactionId }, { transactionId }],
        status: { not: "rejected" },
      },
      select: { id: true, status: true },
    });
    if (dup) throw new Error(`Duplicate transaction/reference detected on request ${dup.id}`);
  }

  return {
    currentPlan,
    requestedPlan,
    plan: requestedPlan,
    billingCycle,
    requestType,
    paymentMethod,
    method: paymentMethod,
    expectedAmount: Number(body.expectedAmount ?? body.amount ?? amountSent),
    amountSent,
    amount: amountSent,
    senderAccountOrNumber: body.senderAccountOrNumber || null,
    transactionId: transactionId || null,
    trxId: transactionId || `manual-${Date.now()}`,
    paymentDate: body.paymentDate || new Date().toISOString().slice(0, 10),
    paymentTime: body.paymentTime || null,
    proofUrl: body.proofUrl || null,
    proofFileName: body.proofFileName || null,
    note: body.note || null,
    status: normalizeStatus(body.status),
    activationMode: body.activationMode || "activate_now",
    requestSource: body.requestSource || "tenant",
  };
}

router.get("/methods", async (_req, res) => {
  try {
    res.json(await getEnabledPaymentMethods());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/summary", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });
    res.json({
      tenantId: tenant.id,
      currentPlan: tenant.subscriptionPlan,
      subscriptionStatus: tenant.subscriptionStatus,
      subscriptionExpiry: tenant.subscriptionExpiry,
      paymentMethods: await getEnabledPaymentMethods(),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const items = await prisma.paymentRequest.findMany({ where: { tenantId: req.tenantId }, orderBy: { createdAt: "desc" } });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const item = await prisma.paymentRequest.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", requireRole("tenant_owner"), async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });

    const openRequest = await prisma.paymentRequest.findFirst({ where: { tenantId: req.tenantId, status: { in: PENDING_REVIEW_STATUSES } }, select: { id: true, status: true } });
    if (openRequest) return res.status(409).json({ message: `A payment request is already ${openRequest.status}`, requestId: openRequest.id });

    const data = await buildPaymentRequestInput(req, req.body, tenant);
    const item = await prisma.paymentRequest.create({ data: { ...data, tenantId: req.tenantId } });
    await writeAuditLog(req, {
      action: "payment_request_created",
      targetId: item.id,
      targetLabel: `${item.requestedPlan || item.plan} - ${item.amountSent || item.amount}`,
      newValue: { plan: item.requestedPlan || item.plan, amount: item.amountSent || item.amount, method: item.paymentMethod || item.method, trxId: item.transactionId || item.trxId },
      metadata: { billingCycle: item.billingCycle, requestType: item.requestType },
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/:id/resubmit", requireRole("tenant_owner"), async (req, res) => {
  try {
    const existing = await prisma.paymentRequest.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!["rejected", "needs_info"].includes(existing.status)) return res.status(400).json({ message: `Cannot resubmit a request in ${existing.status} state` });

    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
    const data = await buildPaymentRequestInput(req, { ...existing, ...req.body, id: existing.id }, tenant);
    const item = await prisma.paymentRequest.update({
      where: { id: existing.id },
      data: { ...data, status: "pending", reviewerComment: null, adminNote: null, rejectionReason: null, reviewedBy: null, reviewedAt: null, processedAt: null },
    });
    await writeAuditLog(req, {
      action: "payment_request_resubmitted",
      targetId: item.id,
      targetLabel: `${item.requestedPlan || item.plan} - ${item.amountSent || item.amount}`,
      oldValue: { status: existing.status, transactionId: existing.transactionId || existing.trxId },
      newValue: { status: item.status, transactionId: item.transactionId || item.trxId },
      metadata: { billingCycle: item.billingCycle, requestType: item.requestType },
    });
    res.json(item);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/:id/cancel", requireRole("tenant_owner"), async (req, res) => {
  try {
    const existing = await prisma.paymentRequest.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!PENDING_REVIEW_STATUSES.includes(existing.status)) return res.status(400).json({ message: `Cannot cancel a request in ${existing.status} state` });

    const item = await prisma.paymentRequest.update({ where: { id: existing.id }, data: { status: "cancelled", processedAt: new Date(), adminNote: req.body?.note || "Cancelled by tenant before review" } });
    await writeAuditLog(req, {
      action: "payment_request_cancelled",
      targetId: item.id,
      targetLabel: `${item.requestedPlan || item.plan} - ${item.amountSent || item.amount}`,
      oldValue: { status: existing.status },
      newValue: { status: item.status },
    });
    res.json(item);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;