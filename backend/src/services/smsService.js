/**
 * SMS Service — provider abstraction with console fallback
 * Supports: Twilio, BulkSMSBD (bulksmsbd.net)
 *
 * Env vars:
 * - SMS_PROVIDER (twilio | bulksmsbd | console)
 * - SMS_API_KEY — BulkSMSBD API key
 * - SMS_SENDER_ID — BulkSMSBD approved sender (e.g. 8809617626936)
 * - SMS_BASE_URL — optional, default https://bulksmsbd.net/api
 * - TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER
 */

const { normalizePhone } = require("../utils/contactValidation");

const SMS_PROVIDER = () => process.env.SMS_PROVIDER || "console";

const BULKSMSBD_ERRORS = {
  1001: "Invalid number",
  1002: "Sender ID not correct or disabled",
  1003: "Required fields missing",
  1005: "BulkSMSBD internal error",
  1006: "Balance validity not available",
  1007: "Insufficient SMS balance",
  1011: "User ID not found (check API key)",
  1012: "Masking SMS must be sent in Bengali",
  1032: "Server IP not whitelisted in BulkSMSBD",
};

function bulkSmsBdBaseUrl() {
  return (process.env.SMS_BASE_URL || "http://bulksmsbd.net/api").replace(/\/$/, "");
}

/** BulkSMSBD expects 88017XXXXXXXX (no + prefix). */
function toBulkSmsNumber(to) {
  const normalized = normalizePhone(to);
  if (normalized) return normalized.replace(/^\+/, "");
  const digits = String(to || "").replace(/\D/g, "");
  return digits || String(to || "");
}

function parseBulkSmsBdResponse(data) {
  const codeRaw = data?.response_code ?? data?.responseCode ?? data?.code;
  const codeNum = typeof codeRaw === "string" ? parseInt(codeRaw, 10) : codeRaw;
  if (codeNum === 202 || codeRaw === "202") {
    return {
      success: true,
      messageId: String(codeNum),
      providerResponse: data,
    };
  }
  const msg =
    data?.success_message ||
    data?.error_message ||
    BULKSMSBD_ERRORS[codeNum] ||
    `BulkSMSBD error (code ${codeRaw ?? "unknown"})`;
  return {
    success: false,
    error: msg,
    code: codeNum,
    providerResponse: data,
  };
}

/**
 * Send an SMS. Falls back to console.log if provider not configured.
 * @param {{ to: string, message: string }} opts
 * @returns {Promise<{ success: boolean, provider: string, messageId?: string, error?: string }>}
 */
async function sendSms({ to, message }) {
  const provider = SMS_PROVIDER();

  if (provider === "twilio") {
    return sendViaTwilio(to, message);
  }

  if (provider === "bulksmsbd") {
    return sendViaBulkSmsBD(to, message);
  }

  // Console fallback
  console.log(`[SMS-LOG] To: ${to} | Message: ${message}`);
  return { success: true, provider: "console", messageId: `LOG-${Date.now()}` };
}

async function sendViaTwilio(to, message) {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !from) {
      console.log(`[SMS-LOG] Twilio not configured. To: ${to} | Message: ${message}`);
      return { success: false, provider: "twilio", error: "Twilio credentials not configured" };
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: message }),
    });
    const data = await res.json();

    if (data.sid) {
      return { success: true, provider: "twilio", messageId: data.sid };
    }
    return { success: false, provider: "twilio", error: data.message || "Twilio send failed" };
  } catch (err) {
    return { success: false, provider: "twilio", error: err.message };
  }
}

async function sendViaBulkSmsBD(to, message) {
  try {
    const apiKey = process.env.SMS_API_KEY;
    const senderId = process.env.SMS_SENDER_ID;

    if (!apiKey) {
      console.log(`[SMS-LOG] BulkSMSBD not configured. To: ${to} | Message: ${message}`);
      return { success: false, provider: "bulksmsbd", error: "SMS_API_KEY not configured" };
    }
    if (!senderId) {
      return { success: false, provider: "bulksmsbd", error: "SMS_SENDER_ID not configured" };
    }

    const number = toBulkSmsNumber(to);
    const params = new URLSearchParams({
      api_key: apiKey,
      type: "text",
      number,
      senderid: senderId,
      message,
    });
    const url = `${bulkSmsBdBaseUrl()}/smsapi?${params.toString()}`;
    const res = await fetch(url);
    const text = await res.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { response_code: text.trim() };
    }

    const parsed = parseBulkSmsBdResponse(data);
    if (parsed.success) {
      return { success: true, provider: "bulksmsbd", messageId: parsed.messageId, providerResponse: parsed.providerResponse };
    }
    console.warn(`[SMS] BulkSMSBD failed: ${parsed.error}`, data);
    return {
      success: false,
      provider: "bulksmsbd",
      error: parsed.error,
      code: parsed.code,
      providerResponse: parsed.providerResponse,
    };
  } catch (err) {
    return { success: false, provider: "bulksmsbd", error: err.message };
  }
}

/** Check BulkSMSBD account balance (super-admin diagnostics). */
async function getSmsBalance() {
  const provider = SMS_PROVIDER();
  if (provider !== "bulksmsbd") {
    return { success: false, provider, error: "Balance check only supported for bulksmsbd" };
  }
  const apiKey = process.env.SMS_API_KEY;
  if (!apiKey) {
    return { success: false, provider: "bulksmsbd", error: "SMS_API_KEY not configured" };
  }
  try {
    const url = `${bulkSmsBdBaseUrl()}/getBalanceApi?api_key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    const text = await res.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.trim() };
    }
    const balance =
      data.balance ??
      data.Balance ??
      data.sms_balance ??
      data.credit ??
      data.main_balance ??
      data.total_balance;
    const codeNum = typeof data.response_code === "string" ? parseInt(data.response_code, 10) : data.response_code;
    if (codeNum && codeNum !== 202 && BULKSMSBD_ERRORS[codeNum]) {
      return {
        success: false,
        provider: "bulksmsbd",
        error: data.error_message || BULKSMSBD_ERRORS[codeNum],
        providerResponse: data,
      };
    }
    return {
      success: balance !== undefined && balance !== null,
      provider: "bulksmsbd",
      balance: balance != null ? String(balance) : undefined,
      providerResponse: data,
      error: balance == null ? "Could not parse balance from provider" : undefined,
    };
  } catch (err) {
    return { success: false, provider: "bulksmsbd", error: err.message };
  }
}

// ── SMS Templates ──
const templates = {
  bookingConfirmation: (data) =>
    `Dear ${data.clientName}, your booking to ${data.destination || "your destination"} on ${data.travelDate || "TBD"} is confirmed. Ref: ${data.bookingRef || "N/A"}. Thank you!`,

  paymentReceived: (data) =>
    `Dear ${data.clientName}, we received your payment of ৳${data.amount} for Invoice ${data.invoiceNumber || "N/A"}. Due: ৳${data.dueAmount || 0}. Thank you!`,

  agencySignupOwner: (data) =>
    `Welcome ${data.ownerName || "Agency Owner"}! Your agency ${data.tenantName || "account"} is ready on Travel Agency Web. Plan: ${data.plan || "trial"}.`,

  agencySignupAdminAlert: (data) =>
    `New agency signup: ${data.tenantName || "Agency"}. Owner: ${data.ownerName || "N/A"}. Email: ${data.ownerEmail || "N/A"}. Phone: ${data.ownerPhone || "N/A"}.`,

  subscriptionActivated: (data) =>
    data.immediate === false
      ? `Your ${data.plan} plan will activate on ${data.activationDate || data.expiryDate}. Valid until ${data.expiryDate}. — Travel Agency Web`
      : `Your ${data.plan} plan is now ACTIVE until ${data.expiryDate}. Log in: app.travelagencyweb.com — Travel Agency Web`,

  subscriptionExpiring: (data) =>
    `Your ${data.plan} plan expires on ${data.expiryDate}. Renew now to avoid interruption. — Travel Agency Web`,

  subscriptionExpiringAdmin: (data) =>
    `Renewal soon: ${data.tenantName || "Agency"} plan ${data.plan} expires on ${data.expiryDate}. Contact the agency for renewal.`,

  trialExpired: (data) =>
    `Dear ${data.ownerName || "Agency Owner"}, your Travel Agency Web trial has ended. Renew: app.travelagencyweb.com/subscription — Travel Agency Web`,

  trialExpiredBn: (data) =>
    `প্রিয় ${data.ownerName || "এজেন্সি মালিক"}, আপনার Travel Agency Web ট্রায়াল শেষ। প্ল্যান রিনিউ: app.travelagencyweb.com/subscription`,

  subscriptionExpired: (data) =>
    `Dear ${data.ownerName || "Agency Owner"}, your ${data.plan || ""} plan has expired. Renew now: app.travelagencyweb.com/subscription — Travel Agency Web`,

  subscriptionExpiredBn: (data) =>
    `প্রিয় ${data.ownerName || "এজেন্সি মালিক"}, আপনার ${data.plan || ""} প্ল্যানের মেয়াদ শেষ। রিনিউ করুন: app.travelagencyweb.com/subscription`,

  trialExpiredAdmin: (data) =>
    `TRIAL ENDED: ${data.tenantName || "Agency"} (${data.ownerPhone || "no phone"}). Expired ${data.expiryDate || "N/A"}. Follow up for renewal.`,

  subscriptionOrderAlert: (data) =>
    `NEW PAYMENT: ${data.tenantName || "Agency"} · Plan ${data.plan} · ৳${data.amount} · ${data.method} · Trx ${data.trxId || "N/A"}. Review in Admin → Payment Requests.`,

  subscriptionOrderConfirmation: (data) =>
    `Payment received for ${data.plan} plan (৳${data.amount}, ${data.method}). Super admin will verify soon. You will get SMS/email when activated. — Travel Agency Web`,

  passwordResetOtp: (data) =>
    `Your password reset code is ${data.otp}. Valid for 10 minutes. Do not share. — Travel Agency Web`,

  invoiceReminder: (data) =>
    `Reminder: Invoice ${data.invoiceNumber} for ৳${data.dueAmount} is due on ${data.dueDate}. Please make payment promptly.`,
};

function getSmsTemplate(templateName, data) {
  const tmpl = templates[templateName];
  if (!tmpl) return null;
  return tmpl(data);
}

module.exports = { sendSms, getSmsTemplate, getSmsBalance, toBulkSmsNumber };