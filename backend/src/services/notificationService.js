/**
 * Notification Service — event-based dispatch to email + SMS + WhatsApp
 * Non-blocking, error-tolerant. Dispatches based on configuration.
 * 
 * Usage: notifyEvent("booking_confirmed", { clientName, clientPhone, clientEmail, ... })
 */
const { sendEmail, sendBookingConfirmation, sendInvoiceEmail } = require("./emailService");
const { sendSms, getSmsTemplate } = require("./smsService");
const { sendWhatsApp } = require("./whatsappService");

const SUPER_ADMIN_ALERT_PHONE = process.env.SUPER_ADMIN_ALERT_PHONE || "+8801674533303";
const SUPER_ADMIN_ALERT_EMAIL = process.env.SUPER_ADMIN_ALERT_EMAIL || process.env.ADMIN_NOTIFICATION_EMAIL || "bditengineer@gmail.com";

/**
 * Dispatch notification for an event.
 * Each handler is fire-and-forget — errors are logged, never thrown.
 */
async function notifyEvent(event, data) {
  const handlers = EVENT_HANDLERS[event];
  if (!handlers) {
    console.log(`[NOTIFY] No handlers for event: ${event}`);
    return;
  }

  const results = await Promise.allSettled(
    handlers.map((handler) => handler(data).catch((e) => console.error(`[NOTIFY] ${event} handler error:`, e.message)))
  );

  console.log(`[NOTIFY] Event ${event} dispatched — ${results.length} handler(s)`);
  return results;
}

function renderAgencySignupOwnerEmail(data) {
  const plan = data.plan || "trial";
  const expiryBlock = data.expiryDate ? `<p><strong>Expiry:</strong> ${data.expiryDate}</p>` : "";
  return {
    subject: `Welcome to Travel Agency Web — ${data.tenantName || "Your Agency"}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#0f172a;">Welcome${data.ownerName ? `, ${data.ownerName}` : ""}!</h2>
        <p>Your agency <strong>${data.tenantName || "account"}</strong> has been created successfully.</p>
        <p><strong>Current plan:</strong> ${plan}</p>
        ${expiryBlock}
        <p>You can now log in and start setting up your agency software and website.</p>
      </div>
    `,
  };
}

function renderAgencySignupAdminEmail(data) {
  return {
    subject: `New agency signup: ${data.tenantName || "Agency"}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#0f172a;">New Agency Signup</h2>
        <p><strong>Agency:</strong> ${data.tenantName || "N/A"}</p>
        <p><strong>Owner:</strong> ${data.ownerName || "N/A"}</p>
        <p><strong>Email:</strong> ${data.ownerEmail || "N/A"}</p>
        <p><strong>Phone:</strong> ${data.ownerPhone || "N/A"}</p>
        <p><strong>Selected plan:</strong> ${data.selectedPlan || data.plan || "N/A"}</p>
      </div>
    `,
  };
}

function renderSubscriptionOrderAgencyEmail(data) {
  return {
    subject: `We received your ${data.requestType || "subscription"} request`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#0f172a;">Subscription request received</h2>
        <p>We received your request for the <strong>${data.plan}</strong> plan.</p>
        <p><strong>Amount:</strong> ৳${Number(data.amount || 0).toLocaleString()}</p>
        <p><strong>Method:</strong> ${data.method || "manual"}</p>
        <p><strong>Reference:</strong> ${data.trxId || "N/A"}</p>
        <p>Our team will review it soon and notify you after approval.</p>
      </div>
    `,
  };
}

function renderSubscriptionOrderAdminEmail(data) {
  return {
    subject: `New subscription order from ${data.tenantName || "Agency"}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#0f172a;">New Subscription Order</h2>
        <p><strong>Agency:</strong> ${data.tenantName || "N/A"}</p>
        <p><strong>Owner:</strong> ${data.ownerName || "N/A"}</p>
        <p><strong>Owner email:</strong> ${data.ownerEmail || "N/A"}</p>
        <p><strong>Owner phone:</strong> ${data.ownerPhone || "N/A"}</p>
        <p><strong>Plan:</strong> ${data.plan || "N/A"}</p>
        <p><strong>Billing:</strong> ${data.billingCycle || "monthly"}</p>
        <p><strong>Request type:</strong> ${data.requestType || "activate"}</p>
        <p><strong>Amount:</strong> ৳${Number(data.amount || 0).toLocaleString()}</p>
        <p><strong>Method:</strong> ${data.method || "manual"}</p>
        <p><strong>Transaction ID:</strong> ${data.trxId || "N/A"}</p>
      </div>
    `,
  };
}

function renderSubscriptionExpiringOwnerEmail(data) {
  return {
    subject: `Your ${data.plan} plan expires soon — renew now`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#0f172a;">Subscription expiring soon</h2>
        <p>Your ${data.plan} plan expires on <strong>${data.expiryDate}</strong>.</p>
        <p>Please renew in time to avoid service interruption.</p>
      </div>
    `,
  };
}

function renderSubscriptionExpiringAdminEmail(data) {
  return {
    subject: `Renewal soon: ${data.tenantName || "Agency"}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#0f172a;">Agency renewal reminder</h2>
        <p><strong>Agency:</strong> ${data.tenantName || "N/A"}</p>
        <p><strong>Owner:</strong> ${data.ownerName || "N/A"}</p>
        <p><strong>Owner email:</strong> ${data.ownerEmail || "N/A"}</p>
        <p><strong>Owner phone:</strong> ${data.ownerPhone || "N/A"}</p>
        <p><strong>Plan:</strong> ${data.plan || "N/A"}</p>
        <p><strong>Expiry:</strong> ${data.expiryDate || "N/A"}</p>
      </div>
    `,
  };
}

// ── Event Handlers ──

const EVENT_HANDLERS = {
  agency_signup: [
    async (data) => {
      if (data.ownerEmail) {
        const mail = renderAgencySignupOwnerEmail(data);
        await sendEmail({ to: data.ownerEmail, subject: mail.subject, html: mail.html });
      }
    },
    async (data) => {
      if (data.ownerPhone) {
        const msg = getSmsTemplate("agencySignupOwner", data);
        if (msg) await sendSms({ to: data.ownerPhone, message: msg });
      }
    },
    async (data) => {
      if (SUPER_ADMIN_ALERT_EMAIL) {
        const mail = renderAgencySignupAdminEmail(data);
        await sendEmail({ to: SUPER_ADMIN_ALERT_EMAIL, subject: mail.subject, html: mail.html });
      }
    },
    async (data) => {
      if (SUPER_ADMIN_ALERT_PHONE) {
        const msg = getSmsTemplate("agencySignupAdminAlert", data);
        if (msg) await sendSms({ to: SUPER_ADMIN_ALERT_PHONE, message: msg });
      }
    },
  ],

  // Booking confirmed → email + SMS + WhatsApp to client
  booking_confirmed: [
    async (data) => {
      if (data.clientEmail) {
        await sendBookingConfirmation(data.booking || data, data.clientEmail);
      }
    },
    async (data) => {
      if (data.clientPhone) {
        const msg = getSmsTemplate("bookingConfirmation", data);
        if (msg) await sendSms({ to: data.clientPhone, message: msg });
      }
    },
    async (data) => {
      if (data.clientPhone) {
        const msg = getSmsTemplate("bookingConfirmation", data);
        if (msg) await sendWhatsApp({ to: data.clientPhone, message: msg });
      }
    },
  ],

  // Payment received → email + SMS to client
  payment_received: [
    async (data) => {
      if (data.clientEmail && data.invoice) {
        await sendInvoiceEmail(data.invoice, data.clientEmail);
      }
    },
    async (data) => {
      if (data.clientPhone) {
        const msg = getSmsTemplate("paymentReceived", data);
        if (msg) await sendSms({ to: data.clientPhone, message: msg });
      }
    },
  ],

  // New subscription order → email + SMS to super admin and owner confirmation
  subscription_order_alert: [
    async (data) => {
      if (SUPER_ADMIN_ALERT_EMAIL) {
        const mail = renderSubscriptionOrderAdminEmail(data);
        await sendEmail({ to: SUPER_ADMIN_ALERT_EMAIL, subject: mail.subject, html: mail.html });
      }
    },
    async (data) => {
      if (SUPER_ADMIN_ALERT_PHONE) {
        const msg = getSmsTemplate("subscriptionOrderAlert", data);
        if (msg) await sendSms({ to: SUPER_ADMIN_ALERT_PHONE, message: msg });
      }
    },
    async (data) => {
      if (data.ownerEmail) {
        const mail = renderSubscriptionOrderAgencyEmail(data);
        await sendEmail({ to: data.ownerEmail, subject: mail.subject, html: mail.html });
      }
    },
    async (data) => {
      if (data.ownerPhone) {
        const msg = getSmsTemplate("subscriptionOrderConfirmation", data);
        if (msg) await sendSms({ to: data.ownerPhone, message: msg });
      }
    },
  ],

  // Subscription activated → email + SMS to tenant owner
  subscription_activated: [
    async (data) => {
      if (data.ownerEmail) {
        await sendEmail({
          to: data.ownerEmail,
          subject: `${data.plan} Plan Activated — Travel Agency Website & Software Solution`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
              <h2>Your ${data.plan} Plan is Active!</h2>
              <p>Your subscription has been activated and is valid until <strong>${data.expiryDate}</strong>.</p>
              <p>Enjoy full access to all features included in the ${data.plan} plan.</p>
            </div>
          `,
        });
      }
    },
    async (data) => {
      if (data.ownerPhone) {
        const msg = getSmsTemplate("subscriptionActivated", data);
        if (msg) await sendSms({ to: data.ownerPhone, message: msg });
      }
    },
  ],

  // Subscription expiring soon → email + SMS reminder to agency and super admin
  subscription_expiring: [
    async (data) => {
      if (data.ownerEmail) {
        const mail = renderSubscriptionExpiringOwnerEmail(data);
        await sendEmail({ to: data.ownerEmail, subject: mail.subject, html: mail.html });
      }
    },
    async (data) => {
      if (data.ownerPhone) {
        const msg = getSmsTemplate("subscriptionExpiring", data);
        if (msg) await sendSms({ to: data.ownerPhone, message: msg });
      }
    },
    async (data) => {
      if (SUPER_ADMIN_ALERT_EMAIL) {
        const mail = renderSubscriptionExpiringAdminEmail(data);
        await sendEmail({ to: SUPER_ADMIN_ALERT_EMAIL, subject: mail.subject, html: mail.html });
      }
    },
    async (data) => {
      if (SUPER_ADMIN_ALERT_PHONE) {
        const msg = getSmsTemplate("subscriptionExpiringAdmin", data);
        if (msg) await sendSms({ to: SUPER_ADMIN_ALERT_PHONE, message: msg });
      }
    },
  ],

  // Invoice reminder
  invoice_reminder: [
    async (data) => {
      if (data.clientEmail) {
        await sendEmail({
          to: data.clientEmail,
          subject: `Payment Reminder: Invoice ${data.invoiceNumber}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
              <h2>Payment Reminder</h2>
              <p>This is a friendly reminder that Invoice <strong>${data.invoiceNumber}</strong> for ৳${data.dueAmount} is due on <strong>${data.dueDate}</strong>.</p>
              <p>Please make payment at your earliest convenience.</p>
            </div>
          `,
        });
      }
    },
    async (data) => {
      if (data.clientPhone) {
        const msg = getSmsTemplate("invoiceReminder", data);
        if (msg) await sendSms({ to: data.clientPhone, message: msg });
      }
    },
  ],

  // Password reset — email only (already handled by emailService, but registered for completeness)
  password_reset: [
    // Handled by emailService.sendPasswordReset directly
  ],
};

module.exports = { notifyEvent };