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

// ── Event Handlers ──

const EVENT_HANDLERS = {
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

  // New subscription order → SMS to super admin
  subscription_order_alert: [
    async (data) => {
      if (SUPER_ADMIN_ALERT_PHONE) {
        const msg = getSmsTemplate("subscriptionOrderAlert", data);
        if (msg) await sendSms({ to: SUPER_ADMIN_ALERT_PHONE, message: msg });
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

  // Subscription expiring soon → email + SMS reminder
  subscription_expiring: [
    async (data) => {
      if (data.ownerEmail) {
        await sendEmail({
          to: data.ownerEmail,
          subject: `Your ${data.plan} Plan Expires Soon — Renew Now`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
              <h2>Subscription Expiring Soon</h2>
              <p>Your ${data.plan} plan expires on <strong>${data.expiryDate}</strong>.</p>
              <p>Renew now to avoid any interruption in service.</p>
            </div>
          `,
        });
      }
    },
    async (data) => {
      if (data.ownerPhone) {
        const msg = getSmsTemplate("subscriptionExpiring", data);
        if (msg) await sendSms({ to: data.ownerPhone, message: msg });
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