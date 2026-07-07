/**
 * SSLCommerz Payment Gateway Route
 * Handles initiation, IPN, success/fail/cancel callbacks
 * 
 * Requires env vars:
 * - SSLCOMMERZ_STORE_ID
 * - SSLCOMMERZ_STORE_PASSWORD
 * - SSLCOMMERZ_SANDBOX (true/false)
 * - API_BASE_URL (for callback URLs)
 */
const router = require("express").Router();
const { authenticate, prisma } = require("../middleware/auth");
const { handlePaymentSuccess, auditPaymentEvent, getCallbackUrls } = require("../services/paymentGateway");

const STORE_ID = () => process.env.SSLCOMMERZ_STORE_ID || "";
const STORE_PASS = () => process.env.SSLCOMMERZ_STORE_PASSWORD || "";
const IS_SANDBOX = () => process.env.SSLCOMMERZ_SANDBOX !== "false";
const API_URL = () => IS_SANDBOX()
  ? "https://sandbox.sslcommerz.com"
  : "https://securepay.sslcommerz.com";

// Server-to-server validation. A callback is only trusted AFTER SSLCommerz's own
// validator confirms the val_id — the posted body is otherwise attacker-controlled
// and must never activate a subscription on its own.
async function validateWithSsl(val_id) {
  if (!val_id || !STORE_ID() || !STORE_PASS()) return null;
  const url = `${API_URL()}/validator/api/validationserverAPI.php?val_id=${encodeURIComponent(val_id)}&store_id=${STORE_ID()}&store_passwd=${STORE_PASS()}&format=json`;
  const data = await fetch(url).then((r) => r.json()).catch(() => null);
  if (data && (data.status === "VALID" || data.status === "VALIDATED")) return data;
  return null;
}

// POST /api/payments/sslcommerz/initiate — authenticated
router.post("/initiate", authenticate, async (req, res) => {
  try {
    const { invoiceId, paymentRequestId, amount, customerName, customerEmail, customerPhone } = req.body;

    if (!STORE_ID() || !STORE_PASS()) {
      return res.status(503).json({ message: "SSLCommerz not configured. Add SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD to .env" });
    }

    const tran_id = `SSL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const urls = getCallbackUrls("sslcommerz");

    const params = new URLSearchParams({
      store_id: STORE_ID(),
      store_passwd: STORE_PASS(),
      total_amount: String(amount),
      currency: "BDT",
      tran_id,
      success_url: urls.success,
      fail_url: urls.fail,
      cancel_url: urls.cancel,
      ipn_url: urls.ipn,
      cus_name: customerName || "Customer",
      cus_email: customerEmail || "customer@email.com",
      cus_phone: customerPhone || "01700000000",
      cus_add1: "Dhaka",
      cus_city: "Dhaka",
      cus_country: "Bangladesh",
      shipping_method: "NO",
      product_name: invoiceId ? `Invoice Payment` : "Subscription Payment",
      product_category: "Travel",
      product_profile: "general",
      value_a: invoiceId || "",
      value_b: paymentRequestId || "",
      value_c: req.tenantId || "",
      value_d: String(amount),
    });

    const response = await fetch(`${API_URL()}/gwprocess/v4`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await response.json();

    if (data.status === "SUCCESS" && data.GatewayPageURL) {
      await auditPaymentEvent({
        action: "payment_initiated",
        gateway: "sslcommerz",
        transactionId: tran_id,
        amount,
        invoiceId,
        paymentRequestId,
        tenantId: req.tenantId,
        metadata: { sessionKey: data.sessionkey },
      });

      res.json({
        success: true,
        transactionId: tran_id,
        redirectUrl: data.GatewayPageURL,
        sessionKey: data.sessionkey,
      });
    } else {
      res.status(400).json({ success: false, message: data.failedreason || "SSLCommerz session creation failed" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/payments/sslcommerz/success — SSLCommerz callback (form-encoded)
router.post("/success", async (req, res) => {
  const FE = process.env.FRONTEND_URL || "https://travelagencyweb.com";
  try {
    const { tran_id, val_id, value_a, value_b, value_c } = req.body;
    const invoiceId = value_a || null;
    const paymentRequestId = value_b || null;
    const tenantId = value_c || null;

    // MANDATORY server-side validation. Without a validated val_id we NEVER activate
    // — the raw callback body cannot be trusted (it is not authenticated).
    const validated = await validateWithSsl(val_id);
    if (!validated) {
      await auditPaymentEvent({ action: "payment_validation_failed", gateway: "sslcommerz", transactionId: tran_id, amount: 0, invoiceId, paymentRequestId, tenantId, metadata: { val_id: val_id || null, reason: "missing_or_invalid_val_id" } });
      return res.redirect(`${FE}/payment/callback?status=failed&tran_id=${tran_id || ""}&gateway=sslcommerz`);
    }

    // Use the amount SSLCommerz validated, not the client-posted value.
    const paidAmount = parseFloat(validated.amount ?? validated.store_amount ?? 0);

    await handlePaymentSuccess({
      transactionId: tran_id || validated.tran_id,
      invoiceId,
      paymentRequestId,
      amount: paidAmount,
      method: "online",
      gateway: "sslcommerz",
      tenantId,
      metadata: { val_id },
    });

    await auditPaymentEvent({ action: "payment_success", gateway: "sslcommerz", transactionId: tran_id, amount: paidAmount, invoiceId, paymentRequestId, tenantId, metadata: { val_id, validatedStatus: validated.status } });

    res.redirect(`${FE}/payment/callback?status=success&tran_id=${tran_id}&gateway=sslcommerz`);
  } catch (err) {
    console.error("[SSLCOMMERZ] Success callback error:", err.message);
    res.redirect(`${FE}/payment/callback?status=failed&error=${encodeURIComponent(err.message)}`);
  }
});

// POST /api/payments/sslcommerz/fail
router.post("/fail", async (req, res) => {
  const { tran_id, value_a, value_b, value_c } = req.body;
  await auditPaymentEvent({ action: "payment_failed", gateway: "sslcommerz", transactionId: tran_id, amount: 0, invoiceId: value_a, paymentRequestId: value_b, tenantId: value_c, metadata: {} });
  res.redirect(`${process.env.FRONTEND_URL || "https://travelagencyweb.com"}/payment/callback?status=failed&tran_id=${tran_id}&gateway=sslcommerz`);
});

// POST /api/payments/sslcommerz/cancel
router.post("/cancel", async (req, res) => {
  const { tran_id, value_a, value_b, value_c } = req.body;
  await auditPaymentEvent({ action: "payment_cancelled", gateway: "sslcommerz", transactionId: tran_id, amount: 0, invoiceId: value_a, paymentRequestId: value_b, tenantId: value_c, metadata: {} });
  res.redirect(`${process.env.FRONTEND_URL || "https://travelagencyweb.com"}/payment/callback?status=cancelled&tran_id=${tran_id}&gateway=sslcommerz`);
});

// POST /api/payments/sslcommerz/ipn — server-to-server validation
router.post("/ipn", async (req, res) => {
  try {
    const { tran_id, val_id, value_a, value_b, value_c } = req.body;

    // The posted `status` is not trusted — re-validate the val_id server-side.
    const validated = await validateWithSsl(val_id);
    if (validated) {
      await handlePaymentSuccess({
        transactionId: tran_id || validated.tran_id,
        invoiceId: value_a || null,
        paymentRequestId: value_b || null,
        amount: parseFloat(validated.amount ?? validated.store_amount ?? 0),
        method: "online",
        gateway: "sslcommerz",
        tenantId: value_c || null,
        metadata: { val_id, source: "ipn" },
      });
      await auditPaymentEvent({ action: "ipn_validated", gateway: "sslcommerz", transactionId: tran_id, amount: parseFloat(validated.amount ?? 0), invoiceId: value_a, paymentRequestId: value_b, tenantId: value_c, metadata: { val_id, status: validated.status } });
    }

    res.json({ status: "ok" });
  } catch (err) {
    console.error("[SSLCOMMERZ] IPN error:", err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
