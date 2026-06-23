/**
 * Auto-expire trials/subscriptions past expiry and dispatch renewal notifications.
 */
const { notifyEvent } = require("./notificationService");
const { resolveTenantOwnerContact } = require("../lib/tenantOwnerContact");

function isPastExpiry(expiry) {
  return expiry && new Date(expiry) < new Date();
}

function shouldAutoExpire(status) {
  return ["active", "trial"].includes(String(status || "").toLowerCase());
}

async function writeAuditLog(prisma, data) {
  return prisma.auditLog.create({ data }).catch(() => null);
}

async function buildOwnerPayload(prisma, tenant) {
  const contact = await resolveTenantOwnerContact(prisma, tenant.id);
  return {
    tenantName: tenant.name,
    ownerName: contact?.ownerName || null,
    ownerEmail: contact?.ownerEmail || null,
    ownerPhone: contact?.phone || null,
    ownerWhatsapp: contact?.whatsapp || null,
    phone: contact?.phone || null,
    whatsapp: contact?.whatsapp || null,
    plan: tenant.subscriptionPlan,
    expiryDate: tenant.subscriptionExpiry?.toISOString?.().slice(0, 10) || null,
  };
}

/**
 * Mark tenant expired and notify owner (email + SMS + WhatsApp).
 * No-op if not eligible.
 */
async function expireTenantAndNotify(prisma, tenant, { skipNotify = false } = {}) {
  if (!tenant?.id) return { expired: false };
  if (!shouldAutoExpire(tenant.subscriptionStatus)) return { expired: false };
  if (!isPastExpiry(tenant.subscriptionExpiry)) return { expired: false };

  const oldStatus = tenant.subscriptionStatus;
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { subscriptionStatus: "expired" },
  });

  await writeAuditLog(prisma, {
    actorId: "system",
    actorName: "System",
    actorEmail: "system",
    actorRole: "system",
    tenantId: tenant.id,
    tenantName: tenant.name,
    module: "subscription",
    action: "auto_expired",
    targetType: "tenant",
    targetId: tenant.id,
    targetLabel: tenant.name,
    oldValue: oldStatus,
    newValue: "expired",
    metadata: { plan: tenant.subscriptionPlan, expiry: tenant.subscriptionExpiry?.toISOString?.() },
  });

  const eventType = String(oldStatus).toLowerCase() === "trial" ? "trial_expired" : "subscription_expired";
  let notifyResult = null;

  if (!skipNotify) {
    const payload = await buildOwnerPayload(prisma, tenant);
    payload.wasTrial = String(oldStatus).toLowerCase() === "trial";
    notifyResult = await notifyEvent(eventType, payload).catch(() => null);

    await writeAuditLog(prisma, {
      actorId: "system",
      actorName: "System",
      actorEmail: "system",
      actorRole: "system",
      tenantId: tenant.id,
      tenantName: tenant.name,
      module: "subscription",
      action: "subscription_expiry_auto_notify",
      targetType: "tenant",
      targetId: tenant.id,
      targetLabel: tenant.name,
      newValue: JSON.stringify({
        eventType,
        email: Boolean(payload.ownerEmail),
        sms: Boolean(payload.ownerPhone),
        whatsapp: Boolean(payload.ownerWhatsapp || payload.ownerPhone),
      }),
    });
  }

  return { expired: true, eventType, oldStatus, notifyResult };
}

/** Lazy expiry on API access when cron has not run yet. */
async function expireTenantIfNeeded(prisma, tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
      subscriptionExpiry: true,
    },
  });
  if (!tenant) return { expired: false };
  return expireTenantAndNotify(prisma, tenant);
}

module.exports = {
  expireTenantAndNotify,
  expireTenantIfNeeded,
  isPastExpiry,
  shouldAutoExpire,
  buildOwnerPayload,
};
