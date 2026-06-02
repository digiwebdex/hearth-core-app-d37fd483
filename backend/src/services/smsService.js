/**
 * SMS Service — provider abstraction with console fallback
 * Supports: Twilio, local BD providers (e.g. BulkSMSBD, Infobip)
 * 
 * Env vars:
 * - SMS_PROVIDER (twilio | bulksmsbd | infobip | console)
 * - SMS_API_KEY / TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN
 * - SMS_SENDER_ID / TWILIO_FROM_NUMBER
 */

const SMS_PROVIDER = () => process.env.SMS_PROVIDER || "console";

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

    const url = `https://bulksmsbd.net/api/smsapi?api_key=${apiKey}&type=text&number=${encodeURIComponent(to)}&senderid=${senderId || "8809617613880"}&message=${encodeURIComponent(message)}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));

    return { success: true, provider: "bulksmsbd", messageId: data.response_code || `BD-${Date.now()}` };
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

  subscriptionActivated: (data) =>
    `Your ${data.plan} plan is now active until ${data.expiryDate}. Enjoy full access to all features. — Travel Agency Web`,

  subscriptionExpiring: (data) =>
    `Your ${data.plan} plan expires on ${data.expiryDate}. Renew now to avoid interruption. — Travel Agency Web`,

  subscriptionOrderAlert: (data) =>
    `New subscription order from ${data.tenantName || "Agency"}. Plan: ${data.plan}. Amount: ৳${data.amount}. Method: ${data.method}. Trx: ${data.trxId || "N/A"}.`,

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

module.exports = { sendSms, getSmsTemplate };