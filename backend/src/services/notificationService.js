/**
 * Notification Service — event-based dispatch to email + SMS + WhatsApp
 * Non-blocking, error-tolerant. Dispatches based on configuration.
 * 
 * Usage: notifyEvent("booking_confirmed", { clientName, clientPhone, clientEmail, ... })
 */
const { sendEmail, sendBookingConfirmation, sendInvoiceEmail } = require("./emailService");
const { sendSms, getSmsTemplate } = require("./smsService");
const { sendWhatsApp } = require("./whatsappService");
const { resolveTenantOwnerContact } = require("../lib/tenantOwnerContact");

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
    subject: `Payment received — ${data.plan} plan request submitted`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#0f172a;">We received your payment details</h2>
        <p>Hello${data.ownerName ? ` ${data.ownerName}` : ""},</p>
        <p>Your subscription payment for <strong>${data.plan}</strong> has been submitted successfully.</p>
        <p><strong>Amount:</strong> ৳${Number(data.amount || 0).toLocaleString()}</p>
        <p><strong>Method:</strong> ${data.method || "manual"}</p>
        <p><strong>Reference:</strong> ${data.trxId || "N/A"}</p>
        <p>Super admin will verify your payment. You will receive <strong>SMS and email</strong> when your plan is activated.</p>
        <p style="color:#666;font-size:13px;">Status: Pending approval</p>
      </div>
    `,
  };
}

function renderSubscriptionOrderAdminEmail(data) {
  const adminLink = process.env.APP_URL || "https://app.travelagencyweb.com";
  return {
    subject: `[Action required] New subscription payment — ${data.tenantName || "Agency"}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#0f172a;">New Subscription Payment</h2>
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
        <p style="margin:24px 0;">
          <a href="${adminLink}/admin/payments" style="background:#ea580c;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">
            Review &amp; Approve
          </a>
        </p>
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

function renderSubscriptionExpiredOwnerEmail(data) {
  const renewUrl = process.env.FRONTEND_URL || "https://app.travelagencyweb.com";
  const headline = data.wasTrial ? "Your trial period has ended" : "Your subscription has expired";
  const body = data.wasTrial
    ? `Your agency <strong>${data.tenantName || ""}</strong> trial expired on <strong>${data.expiryDate || ""}</strong>.`
    : `Your <strong>${data.plan || ""}</strong> subscription for <strong>${data.tenantName || ""}</strong> expired on <strong>${data.expiryDate || ""}</strong>.`;
  return {
    subject: `${data.wasTrial ? "Trial ended" : "Subscription expired"} — ${data.tenantName || "Your agency"} | Travel Agency Web`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#0f172a;">${headline}</h2>
        <p>Hello ${data.ownerName || ""},</p>
        <p>${body}</p>
        <p>Renew your subscription to continue using bookings, quotations, and your website.</p>
        <p style="margin:24px 0;">
          <a href="${renewUrl}/subscription" style="background:#ea580c;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">
            Renew subscription
          </a>
        </p>
      </div>
    `,
  };
}

function renderTrialExpiredOwnerEmail(data) {
  return renderSubscriptionExpiredOwnerEmail({ ...data, wasTrial: true });
}

function renderTrialExpiredAdminEmail(data) {
  return {
    subject: `[Trial ended] ${data.tenantName || "Agency"}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#0f172a;">Agency trial ended</h2>
        <p><strong>Agency:</strong> ${data.tenantName || "N/A"}</p>
        <p><strong>Owner:</strong> ${data.ownerName || "N/A"}</p>
        <p><strong>Phone:</strong> ${data.ownerPhone || "N/A"}</p>
        <p><strong>WhatsApp:</strong> ${data.ownerWhatsapp || "N/A"}</p>
        <p><strong>Expired:</strong> ${data.expiryDate || "N/A"}</p>
      </div>
    `,
  };
}

function buildTrialExpiredMessage(data, useBn = false) {
  const tmpl = useBn ? getSmsTemplate("trialExpiredBn", data) : getSmsTemplate("trialExpired", data);
  return tmpl || `Your trial has ended. Renew at app.travelagencyweb.com/subscription`;
}

function buildRenewalExpiredMessage(data, useBn = false) {
  const wasTrial = Boolean(data.wasTrial);
  if (wasTrial) {
    return buildTrialExpiredMessage(data, useBn);
  }
  if (useBn) {
    const bn = getSmsTemplate("subscriptionExpiredBn", data);
    if (bn) return bn;
  }
  const en = getSmsTemplate("subscriptionExpired", data);
  return en || `Your ${data.plan || ""} subscription has expired. Renew: app.travelagencyweb.com/subscription`;
}

async function sendRenewalExpiryChannels(data, { sms = true, whatsapp = true, email = true } = {}) {
  const results = { sms: null, whatsapp: null, email: null };
  const phone = data.ownerPhone || data.phone;
  const wa = data.ownerWhatsapp || data.whatsapp || phone;
  const useBn = String(process.env.TRIAL_EXPIRY_SMS_LANG || "").toLowerCase() === "bn";
  const msg = buildRenewalExpiredMessage(data, useBn);

  if (sms && phone) {
    results.sms = await sendSms({ to: phone, message: msg });
  }
  if (whatsapp && wa) {
    results.whatsapp = await sendWhatsApp({ to: wa, message: msg });
  }
  if (email && data.ownerEmail) {
    const mail = renderSubscriptionExpiredOwnerEmail(data);
    results.email = await sendEmail({ to: data.ownerEmail, subject: mail.subject, html: mail.html });
  }
  return results;
}

/** @deprecated Use sendRenewalExpiryChannels */
async function sendTrialExpiryChannels(data, options = {}) {
  return sendRenewalExpiryChannels(data, options);
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
        const appUrl = data.appUrl || process.env.FRONTEND_URL || "https://app.travelagencyweb.com";
        const loginUrl = appUrl.includes("app.") ? appUrl : `${appUrl.replace(/\/$/, "")}/login`;
        const headline = data.immediate === false
          ? `Your ${data.plan} plan is scheduled`
          : `Your ${data.plan} plan is active!`;
        const body = data.immediate === false
          ? `<p>Your ${data.plan} subscription will activate on <strong>${data.activationDate}</strong> and remain valid until <strong>${data.expiryDate}</strong>.</p>`
          : `<p>Your subscription is now active and valid until <strong>${data.expiryDate}</strong>.</p><p>You can log in and use your agency portal immediately.</p>`;

        await sendEmail({
          to: data.ownerEmail,
          subject: `${data.plan} Plan ${data.immediate === false ? "Scheduled" : "Activated"} — Travel Agency Web`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
              <h2 style="color:#0f172a;">${headline}</h2>
              ${data.tenantName ? `<p><strong>Agency:</strong> ${data.tenantName}</p>` : ""}
              ${body}
              <p style="margin:24px 0;">
                <a href="${loginUrl}" style="background:#ea580c;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">
                  Log in to your portal
                </a>
              </p>
              <p style="color:#666;font-size:13px;">Payment method: ${data.method || "manual"}${data.trxId ? ` · Ref: ${data.trxId}` : ""}</p>
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
      const wa = data.ownerWhatsapp || data.ownerPhone;
      if (wa) {
        const msg = getSmsTemplate("subscriptionExpiring", data);
        if (msg) await sendWhatsApp({ to: wa, message: msg });
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

  // Trial or subscription expired → email + SMS + WhatsApp to agency owner; alert super admin
  trial_expired: [
    async (data) => sendRenewalExpiryChannels({ ...data, wasTrial: true }, { sms: true, whatsapp: true, email: true }),
    async (data) => {
      if (SUPER_ADMIN_ALERT_EMAIL) {
        const mail = renderTrialExpiredAdminEmail(data);
        await sendEmail({ to: SUPER_ADMIN_ALERT_EMAIL, subject: mail.subject, html: mail.html });
      }
    },
    async (data) => {
      if (SUPER_ADMIN_ALERT_PHONE) {
        const msg = getSmsTemplate("trialExpiredAdmin", data);
        if (msg) await sendSms({ to: SUPER_ADMIN_ALERT_PHONE, message: msg });
      }
    },
  ],

  subscription_expired: [
    async (data) => sendRenewalExpiryChannels({ ...data, wasTrial: false }, { sms: true, whatsapp: true, email: true }),
    async (data) => {
      if (SUPER_ADMIN_ALERT_EMAIL) {
        const mail = renderTrialExpiredAdminEmail({ ...data, wasTrial: false });
        await sendEmail({ to: SUPER_ADMIN_ALERT_EMAIL, subject: mail.subject, html: mail.html });
      }
    },
    async (data) => {
      if (SUPER_ADMIN_ALERT_PHONE) {
        const msg = getSmsTemplate("trialExpiredAdmin", data);
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

module.exports = {
  notifyEvent,
  sendRenewalExpiryChannels,
  sendTrialExpiryChannels,
  buildTrialExpiredMessage,
  buildRenewalExpiredMessage,
  resolveTenantOwnerContact,
};