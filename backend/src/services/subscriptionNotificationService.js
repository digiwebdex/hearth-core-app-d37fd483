/**
 * Subscription payment notifications — SMS + email on submit and approve.
 */
const { PrismaClient } = require("@prisma/client");
const { notifyEvent } = require("./notificationService");
const { createPlatformNotification } = require("./platformNotificationService");

const prisma = new PrismaClient();

async function getTenantOwnerContact(tenantId) {
  const [tenant, owner] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, phone: true, whatsapp: true },
    }),
    prisma.user.findFirst({
      where: { tenantId, role: "tenant_owner" },
      select: { id: true, name: true, email: true, phone: true, whatsapp: true },
    }),
  ]);

  return {
    tenant,
    owner,
    ownerName: owner?.name || null,
    ownerEmail: owner?.email || null,
    ownerPhone: owner?.phone || owner?.whatsapp || tenant?.phone || tenant?.whatsapp || null,
    ownerUserId: owner?.id || null,
  };
}

function formatPlan(plan) {
  const value = String(plan || "basic").trim();
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatExpiry(date) {
  if (!date) return "N/A";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toISOString().slice(0, 10);
}

function paymentPayload(tenant, item) {
  return {
    tenantName: tenant?.name || "Agency",
    tenantId: tenant?.id || null,
    plan: item.requestedPlan || item.plan,
    amount: item.amountSent || item.amount,
    method: item.paymentMethod || item.method || "manual",
    trxId: item.transactionId || item.trxId || null,
    billingCycle: item.billingCycle || "monthly",
    requestType: item.requestType || "activate",
  };
}

/**
 * Agency submits subscription payment → notify super admin + agency owner (email + SMS).
 */
async function notifySubscriptionPaymentSubmitted({ tenant, item, submittedByUserId }) {
  const contact = await getTenantOwnerContact(tenant?.id);
  const submitter = submittedByUserId
    ? await prisma.user.findUnique({
        where: { id: submittedByUserId },
        select: { email: true, name: true, phone: true },
      }).catch(() => null)
    : null;

  const payload = {
    ...paymentPayload(tenant, item),
    ownerName: contact.ownerName || submitter?.name || null,
    ownerEmail: contact.ownerEmail || submitter?.email || null,
    ownerPhone: contact.ownerPhone || submitter?.phone || null,
  };

  try {
    await createPlatformNotification({
      type: "payment_request",
      title: "New Payment Request",
      message: `${payload.tenantName} submitted ৳${payload.amount} for ${payload.plan} via ${payload.method}${payload.trxId ? ` (${payload.trxId})` : ""}.`,
      link: "/admin/payments",
      metadata: {
        tenantId: tenant?.id,
        requestId: item.id,
        plan: payload.plan,
        amount: String(payload.amount),
        method: payload.method,
      },
    });
  } catch (_e) {
    /* non-blocking */
  }

  await notifyEvent("subscription_order_alert", payload).catch((err) => {
    console.error("[NOTIFY] subscription_order_alert failed:", err.message);
  });
}

/**
 * Super admin approves payment → notify agency owner (email + SMS) + in-app notification.
 */
async function notifySubscriptionPaymentApproved({
  tenant,
  paymentRequest,
  plan,
  expiryDate,
  immediate = true,
  activationDate,
}) {
  const contact = await getTenantOwnerContact(tenant?.id);
  const formattedPlan = formatPlan(plan);
  const expiry = formatExpiry(expiryDate);

  const payload = {
    tenantName: tenant?.name || "Agency",
    ownerName: contact.ownerName,
    ownerEmail: contact.ownerEmail,
    ownerPhone: contact.ownerPhone,
    plan: formattedPlan,
    expiryDate: expiry,
    amount: paymentRequest.amountSent || paymentRequest.amount,
    method: paymentRequest.paymentMethod || paymentRequest.method || "manual",
    trxId: paymentRequest.transactionId || paymentRequest.trxId || null,
    immediate,
    activationDate: formatExpiry(activationDate || expiryDate),
    appUrl: process.env.FRONTEND_URL?.includes("app.")
      ? process.env.FRONTEND_URL
      : process.env.APP_URL || "https://app.travelagencyweb.com",
  };

  if (contact.ownerUserId && tenant?.id) {
    await prisma.notification
      .create({
        data: {
          tenantId: tenant.id,
          userId: contact.ownerUserId,
          type: "subscription_activated",
          title: immediate ? `${formattedPlan} plan activated` : `${formattedPlan} plan scheduled`,
          message: immediate
            ? `Your subscription is active until ${expiry}. You can log in and use the portal now.`
            : `Your ${formattedPlan} plan will activate on ${payload.activationDate}.`,
          link: "/dashboard",
        },
      })
      .catch(() => {});
  }

  await notifyEvent("subscription_activated", payload).catch((err) => {
    console.error("[NOTIFY] subscription_activated failed:", err.message);
  });
}

module.exports = {
  getTenantOwnerContact,
  notifySubscriptionPaymentSubmitted,
  notifySubscriptionPaymentApproved,
};
