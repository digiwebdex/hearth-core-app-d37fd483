/**
 * Unified Payment Router — dispatches to SSLCommerz, bKash, or COD
 * Frontend calls these endpoints, which delegate to gateway-specific routes
 */
const router = require("express").Router();
const { authenticate, prisma } = require("../middleware/auth");
const { handlePaymentSuccess, auditPaymentEvent } = require("../services/paymentGateway");

// Mount gateway-specific routes
router.use("/sslcommerz", require("./sslcommerz"));
router.use("/bkash", require("./bkash"));

// GET /api/payments — list all payments for current tenant
router.get("/", authenticate, async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        invoice: { select: { id: true, invoiceNumber: true, clientId: true } },
      },
    });
    res.json(payments);
  } catch (e) {
    console.error("GET /payments error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/payments/initiate — universal payment initiation
router.post("/initiate", authenticate, async (req, res) => {
  try {
    const { invoiceId, paymentRequestId, amount, gateway, customerName, customerEmail, customerPhone } = req.body;

    if (!gateway) return res.status(400).json({ message: "Gateway is required" });
    if (!amount || amount <= 0) return res.status(400).json({ message: "Valid amount is required" });

    // COD — instant confirmation
    if (gateway === "cod") {
      const tran_id = `COD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      if (invoiceId || paymentRequestId) {
        await handlePaymentSuccess({
          transactionId: tran_id,
          invoiceId: invoiceId || null,
          paymentRequestId: paymentRequestId || null,
          amount,
          method: "cod",
          gateway: "cod",
          tenantId: req.tenantId,
          metadata: { customerName, customerEmail, customerPhone },
        });
      }

      await auditPaymentEvent({
        action: "payment_cod_confirmed",
        gateway: "cod",
        transactionId: tran_id,
        amount,
        invoiceId: invoiceId || null,
        paymentRequestId: paymentRequestId || null,
        tenantId: req.tenantId,
        metadata: { customerName, customerEmail, customerPhone },
      });

      return res.json({ success: true, transactionId: tran_id, message: "Cash on delivery confirmed" });
    }

    // SSLCommerz — proxy to SSLCommerz initiate
    if (gateway === "sslcommerz") {
      req.url = "/sslcommerz/initiate";
      req.body = { invoiceId, paymentRequestId, amount, customerName, customerEmail, customerPhone };
      return router.handle(req, res);
    }

    // bKash — proxy to bKash create
    if (gateway === "bkash") {
      req.url = "/bkash/create";
      req.body = { invoiceId, paymentRequestId, amount, customerPhone };
      return router.handle(req, res);
    }

    res.status(400).json({ message: `Unsupported gateway: ${gateway}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/payments/status/:transactionId — check payment status
router.get("/status/:transactionId", authenticate, async (req, res) => {
  try {
    const { transactionId } = req.params;

    const log = await prisma.auditLog.findFirst({
      where: {
        tenantId: req.tenantId,
        module: "payment_gateway",
        targetLabel: transactionId,
        action: { in: ["payment_success", "payment_failed", "payment_cancelled", "payment_cod_confirmed", "ipn_validated"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!log) {
      const initiated = await prisma.auditLog.findFirst({
        where: { tenantId: req.tenantId, module: "payment_gateway", targetLabel: transactionId, action: { in: ["payment_initiated", "bkash_created"] } },
      });
      if (initiated) {
        return res.json({ transactionId, status: "pending", gateway: "unknown" });
      }
      return res.status(404).json({ message: "Transaction not found" });
    }

    const meta = log.newValue ? JSON.parse(log.newValue) : {};
    const statusMap = {
      payment_success: "success",
      ipn_validated: "success",
      payment_cod_confirmed: "success",
      payment_failed: "failed",
      payment_cancelled: "cancelled",
    };

    res.json({
      transactionId,
      invoiceId: log.targetId,
      amount: meta.amount || 0,
      gateway: meta.gateway || "unknown",
      status: statusMap[log.action] || "pending",
      paidAt: log.createdAt,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/payments/callback/:gateway — frontend validates callback
router.post("/callback/:gateway", async (req, res) => {
  try {
    const { gateway } = req.params;
    const tranId = req.body?.tran_id || req.query?.tran_id || req.body?.paymentID || req.query?.paymentID || "";

    const log = await prisma.auditLog.findFirst({
      where: { module: "payment_gateway", targetLabel: tranId },
      orderBy: { createdAt: "desc" },
    });

    if (!log) return res.status(404).json({ message: "Transaction not found" });

    const meta = log.newValue ? JSON.parse(log.newValue) : {};
    const statusMap = {
      payment_success: "success",
      ipn_validated: "success",
      payment_cod_confirmed: "success",
      payment_failed: "failed",
      payment_cancelled: "cancelled",
    };

    res.json({
      transactionId: tranId,
      invoiceId: meta.invoiceId || log.targetId,
      amount: meta.amount || 0,
      gateway,
      status: statusMap[log.action] || "pending",
      paidAt: log.createdAt,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;