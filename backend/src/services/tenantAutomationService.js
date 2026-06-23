/**
 * Tenant-scoped notification automation (P1.1).
 * Channels: in_app + sms only. Non-blocking; never throws to HTTP handlers.
 */
const { PrismaClient } = require("@prisma/client");
const { sendSms } = require("./smsService");
const { messagePreview } = require("../middleware/upload");

const prisma = new PrismaClient();

const AUTOMATION_EVENTS = ["lead_created", "booking_created", "payment_received", "quotation_sent"];

const EVENT_MASTER_TOGGLE = {
  lead_created: "notifyOnLead",
  booking_created: "notifyOnBooking",
  payment_received: "notifyOnPayment",
  quotation_sent: "notifyOnBooking",
};

const SMS_TEMPLATE_TYPE = {
  lead_created: "custom",
  booking_created: "booking",
  payment_received: "payment",
  quotation_sent: "custom",
};

const NOTIFICATION_TYPE = {
  lead_created: "system",
  booking_created: "booking_created",
  payment_received: "payment_received",
  quotation_sent: "quotation_sent",
};

const NOTIFICATION_LINK = {
  lead_created: "/leads",
  booking_created: "/bookings",
  payment_received: "/invoices",
  quotation_sent: "/quotations",
};

function isSmsEnvConfigured() {
  if (process.env.SMS_ENABLED === "false") return false;
  const provider = (process.env.SMS_PROVIDER || "console").toLowerCase();
  if (provider === "console") return true;
  if (provider === "twilio") {
    return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  }
  if (provider === "bulksmsbd") return Boolean(process.env.SMS_API_KEY);
  return Boolean(process.env.SMS_API_KEY);
}

function renderTemplate(template, data) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? `{{${key}}}`);
}

function buildVariableMap(payload) {
  return {
    name: payload.clientName || payload.leadName || "Customer",
    bookingId: payload.bookingId || "",
    type: payload.bookingType || "",
    status: payload.bookingStatus || "",
    amount: payload.amount != null ? String(payload.amount) : "0",
    date: payload.date || new Date().toISOString().slice(0, 10),
    agent: payload.agentName || "",
    company: payload.tenantName || "Travel Agency",
    invoiceId: payload.invoiceId || "",
    method: payload.paymentMethod || "",
    quotationTitle: payload.quotationTitle || "",
    quotationTotal: payload.quotationTotal != null ? String(payload.quotationTotal) : "0",
    destination: payload.destination || "",
    balance: payload.balance != null ? String(payload.balance) : "0",
  };
}
  let settings = await prisma.smsSettings.findUnique({ where: { tenantId } });
  if (!settings) {
    settings = await prisma.smsSettings.create({
      data: { tenantId },
    });
  }

  const existing = await prisma.notificationAutomation.findMany({ where: { tenantId } });
  const have = new Set(existing.map((row) => row.eventType));
  const missing = AUTOMATION_EVENTS.filter((eventType) => !have.has(eventType));
  if (missing.length) {
    await prisma.notificationAutomation.createMany({
      data: missing.map((eventType) => ({ tenantId, eventType })),
    });
  }

  const events = await prisma.notificationAutomation.findMany({
    where: { tenantId, eventType: { in: AUTOMATION_EVENTS } },
    orderBy: { eventType: "asc" },
  });

  return { settings, events };
}

function formatSettingsResponse(settings) {
  return {
    tenantId: settings.tenantId,
    smsEnabled: settings.smsEnabled,
    notifyOnBooking: settings.notifyOnBooking,
    notifyOnPayment: settings.notifyOnPayment,
    notifyOnLead: settings.notifyOnLead,
    smsEnvConfigured: isSmsEnvConfigured(),
    updatedAt: settings.updatedAt,
  };
}

async function recordDelivery(data) {
  return prisma.notificationDelivery.create({ data });
}

async function sendInAppChannel({ tenantId, eventType, title, message, actorUserId, relatedType, relatedId }) {
  const delivery = await recordDelivery({
    tenantId,
    eventType,
    channel: "in_app",
    status: "pending",
    recipient: "tenant",
    recipientName: title,
    message,
    relatedType,
    relatedId,
  });

  try {
    const notification = await prisma.notification.create({
      data: {
        tenantId,
        userId: null,
        actorUserId: actorUserId || null,
        type: NOTIFICATION_TYPE[eventType] || "system",
        title,
        message,
        link: NOTIFICATION_LINK[eventType] || null,
      },
    });

    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "sent",
        sentAt: new Date(),
        notificationId: notification.id,
        recipient: tenantId,
      },
    });
    return { success: true };
  } catch (err) {
    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: { status: "failed", errorMessage: err.message },
    });
    return { success: false, error: err.message };
  }
}

async function sendSmsChannel({ tenantId, eventType, phone, message, templateId, actorUserId, relatedType, relatedId, recipientName }) {
  const delivery = await recordDelivery({
    tenantId,
    eventType,
    channel: "sms",
    status: "pending",
    recipient: phone,
    recipientName: recipientName || phone,
    message,
    relatedType,
    relatedId,
  });

  try {
    const smsLog = await prisma.smsLog.create({
      data: {
        tenantId,
        phone,
        message,
        status: "pending",
        provider: process.env.SMS_PROVIDER || "console",
        templateId: templateId || null,
        templateType: SMS_TEMPLATE_TYPE[eventType] || null,
        createdByUserId: actorUserId || null,
      },
    });

    const result = await sendSms({ to: phone, message });
    await prisma.smsLog.update({
      where: { id: smsLog.id },
      data: {
        status: result.success ? "sent" : "failed",
        provider: result.provider,
        providerMessageId: result.messageId || null,
        errorMessage: result.error || null,
        sentAt: result.success ? new Date() : null,
      },
    });

    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: result.success ? "sent" : "failed",
        errorMessage: result.error || null,
        sentAt: result.success ? new Date() : null,
      },
    });

    return { success: result.success, error: result.error };
  } catch (err) {
    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: { status: "failed", errorMessage: err.message },
    }).catch(() => {});
    return { success: false, error: err.message };
  }
}

async function resolveSmsMessage(eventType, payload) {
  const templateType = SMS_TEMPLATE_TYPE[eventType];
  const templates = await prisma.smsTemplate.findMany({
    where: {
      isActive: true,
      type: templateType,
      OR: [{ tenantId: null }, { tenantId: payload.tenantId }],
    },
    orderBy: { createdAt: "desc" },
  });

  const template = templates[0];
  const variables = buildVariableMap(payload);

  if (template) {
    return { message: renderTemplate(template.message, variables), templateId: template.id };
  }

  if (eventType === "lead_created") {
    return {
      message: `New lead: ${payload.leadName || "Unknown"} — ${payload.leadPhone || "no phone"}. - ${payload.tenantName || "Travel Agency"}`,
      templateId: null,
    };
  }
  if (eventType === "booking_created") {
    return {
      message: `Dear ${variables.name}, your booking ${payload.bookingTitle || payload.bookingId || ""} is confirmed. Amount: ${variables.amount} BDT. - ${variables.company}`,
      templateId: null,
    };
  }
  if (eventType === "quotation_sent") {
    return {
      message: `Dear ${variables.name}, your quotation for ${payload.destination || payload.quotationTitle || "travel"} is ready. Total: ${variables.quotationTotal} BDT. - ${variables.company}`,
      templateId: null,
    };
  }
  return {
    message: `Dear ${variables.name}, we received your payment of ${variables.amount} BDT. - ${variables.company}`,
    templateId: null,
  };
}

function buildInAppMessage(eventType, payload) {
  if (eventType === "lead_created") {
    return `New lead ${payload.leadName || ""} from ${payload.leadSource || "ERP"}.`;
  }
  if (eventType === "booking_created") {
    return `${payload.bookingTitle || "Booking"} created for ${payload.clientName || "client"} — ৳${Number(payload.amount || 0).toLocaleString()}.`;
  }
  if (eventType === "quotation_sent") {
    return `Quotation sent: ${payload.quotationTitle || payload.destination || "New quote"} — ৳${Number(payload.quotationTotal || 0).toLocaleString()}.`;
  }
  return `Payment of ৳${Number(payload.amount || 0).toLocaleString()} received for ${payload.invoiceNumber || payload.invoiceId || "invoice"}.`;
}

function buildInAppTitle(eventType) {
  if (eventType === "lead_created") return "New Lead";
  if (eventType === "booking_created") return "New Booking";
  if (eventType === "quotation_sent") return "Quotation Sent";
  return "Payment Received";
}

function isMasterEnabled(settings, eventType) {
  const key = EVENT_MASTER_TOGGLE[eventType];
  return key ? settings[key] : false;
}

async function dispatchTenantAutomation(eventType, ctx) {
  if (!AUTOMATION_EVENTS.includes(eventType)) return;

  const { tenantId, actorUserId, payload = {} } = ctx;
  if (!tenantId) return;

  try {
    const { settings, events } = await ensureTenantSettings(tenantId);
    if (!isMasterEnabled(settings, eventType)) return;

    const automation = events.find((row) => row.eventType === eventType);
    if (!automation) return;

    const fullPayload = { ...payload, tenantId };
    const inAppMessage = buildInAppMessage(eventType, fullPayload);
    const title = buildInAppTitle(eventType);

    if (automation.inApp) {
      await sendInAppChannel({
        tenantId,
        eventType,
        title,
        message: inAppMessage,
        actorUserId,
        relatedType: payload.relatedType,
        relatedId: payload.relatedId,
      });
    }

    const phone = payload.clientPhone || payload.leadPhone;
    if (automation.sms && settings.smsEnabled && isSmsEnvConfigured() && phone) {
      const { message, templateId } = await resolveSmsMessage(eventType, fullPayload);
      await sendSmsChannel({
        tenantId,
        eventType,
        phone,
        message,
        templateId,
        actorUserId,
        relatedType: payload.relatedType,
        relatedId: payload.relatedId,
        recipientName: payload.clientName || payload.leadName,
      });
    } else if (automation.sms && settings.smsEnabled && phone) {
      const { message } = await resolveSmsMessage(eventType, fullPayload);
      await recordDelivery({
        tenantId,
        eventType,
        channel: "sms",
        status: "failed",
        recipient: phone,
        recipientName: payload.clientName || payload.leadName || phone,
        message,
        errorMessage: !phone ? "No phone number" : "SMS environment not configured",
        relatedType: payload.relatedType,
        relatedId: payload.relatedId,
      });
    }
  } catch (err) {
    console.error(`[automation] ${eventType} dispatch error:`, err.message);
  }
}

function formatDeliveryListItem(row) {
  return {
    id: row.id,
    eventType: row.eventType,
    channel: row.channel,
    status: row.status,
    recipient: row.recipient,
    recipientName: row.recipientName,
    messagePreview: messagePreview(row.message),
    relatedType: row.relatedType,
    relatedId: row.relatedId,
    notificationId: row.notificationId,
    attempts: row.attempts,
    sentAt: row.sentAt,
    createdAt: row.createdAt,
  };
}

module.exports = {
  AUTOMATION_EVENTS,
  ensureTenantSettings,
  formatSettingsResponse,
  formatDeliveryListItem,
  dispatchTenantAutomation,
  isSmsEnvConfigured,
};
