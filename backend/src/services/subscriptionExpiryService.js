/**
 * Auto-expire trials/subscriptions past expiry and dispatch renewal notifications.
 */
const { notifyEvent, sendRenewalExpiryChannels } = require("./notificationService");
const { resolveTenantOwnerContact } = require("../lib/tenantOwnerContact");
const { isPlatformTenant } = require("../lib/platformTenant");

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

/**
 * Manually send renewal reminder via selected channels (super admin).
 * Skips unavailable channels per tenant instead of failing the whole request.
 */
async function sendManualRenewalNotify(prisma, actorUserId, tenantId, channels) {
  const sendSmsChannel = channels.includes("sms");
  const sendWaChannel = channels.includes("whatsapp");
  const sendEmailChannel = channels.includes("email");
  if (!sendSmsChannel && !sendWaChannel && !sendEmailChannel) {
    return { ok: false, tenantId, error: "No channels selected" };
  }

  const contact = await resolveTenantOwnerContact(prisma, tenantId);
  if (!contact?.tenant) return { ok: false, tenantId, error: "Tenant not found" };
  if (isPlatformTenant(contact.tenant)) {
    return { ok: false, tenantId, tenantName: contact.tenant.name, error: "Platform tenant skipped" };
  }

  const canSendSms = sendSmsChannel && Boolean(contact.phone);
  const canSendWa = sendWaChannel && Boolean(contact.whatsapp || contact.phone);
  const canSendEmail = sendEmailChannel && Boolean(contact.ownerEmail);
  if (!canSendSms && !canSendWa && !canSendEmail) {
    const missing = [];
    if (sendSmsChannel && !contact.phone) missing.push("SMS (no phone)");
    if (sendWaChannel && !contact.whatsapp && !contact.phone) missing.push("WhatsApp (no number)");
    if (sendEmailChannel && !contact.ownerEmail) missing.push("Email (no address)");
    return {
      ok: false,
      tenantId,
      tenantName: contact.tenant.name,
      error: missing.join("; ") || "No contact details",
    };
  }

  const wasTrial = String(contact.tenant.subscriptionStatus || "").toLowerCase() === "trial"
    || String(contact.tenant.subscriptionPlan || "").toLowerCase() === "free";
  const payload = {
    tenantName: contact.tenant.name,
    ownerName: contact.ownerName,
    ownerEmail: contact.ownerEmail,
    ownerPhone: contact.phone,
    ownerWhatsapp: contact.whatsapp,
    phone: contact.phone,
    whatsapp: contact.whatsapp,
    plan: contact.tenant.subscriptionPlan,
    expiryDate: contact.tenant.subscriptionExpiry?.toISOString?.().slice(0, 10),
    wasTrial,
  };

  const results = await sendRenewalExpiryChannels(payload, {
    sms: canSendSms,
    whatsapp: canSendWa,
    email: canSendEmail,
  });

  const actor = actorUserId
    ? await prisma.user.findUnique({ where: { id: actorUserId }, select: { name: true, email: true, role: true } })
    : null;

  if (canSendSms) {
    await writeAuditLog(prisma, {
      actorId: actorUserId || "system",
      actorName: actor?.name || "",
      actorEmail: actor?.email || "",
      actorRole: actor?.role || "",
      tenantId: contact.tenant.id,
      tenantName: contact.tenant.name,
      module: "subscription",
      action: "trial_expiry_manual_sms",
      targetType: "tenant",
      targetId: contact.tenant.id,
      targetLabel: contact.tenant.name,
      newValue: JSON.stringify({ phone: contact.phone, success: results.sms?.success }),
    });
  }
  if (canSendWa) {
    await writeAuditLog(prisma, {
      actorId: actorUserId || "system",
      actorName: actor?.name || "",
      actorEmail: actor?.email || "",
      actorRole: actor?.role || "",
      tenantId: contact.tenant.id,
      tenantName: contact.tenant.name,
      module: "subscription",
      action: "trial_expiry_manual_whatsapp",
      targetType: "tenant",
      targetId: contact.tenant.id,
      targetLabel: contact.tenant.name,
      newValue: JSON.stringify({ whatsapp: contact.whatsapp, success: results.whatsapp?.success }),
    });
  }
  if (canSendEmail) {
    await writeAuditLog(prisma, {
      actorId: actorUserId || "system",
      actorName: actor?.name || "",
      actorEmail: actor?.email || "",
      actorRole: actor?.role || "",
      tenantId: contact.tenant.id,
      tenantName: contact.tenant.name,
      module: "subscription",
      action: "trial_expiry_manual_email",
      targetType: "tenant",
      targetId: contact.tenant.id,
      targetLabel: contact.tenant.name,
      newValue: JSON.stringify({ email: contact.ownerEmail, success: results.email?.success !== false }),
    });
  }

  return {
    ok: true,
    tenantId: contact.tenant.id,
    tenantName: contact.tenant.name,
    phone: contact.phone,
    whatsapp: contact.whatsapp,
    email: contact.ownerEmail,
    results,
    warnings: [
      sendSmsChannel && !canSendSms ? "SMS skipped — no phone" : null,
      sendWaChannel && !canSendWa ? "WhatsApp skipped — no number" : null,
      sendEmailChannel && !canSendEmail ? "Email skipped — no address" : null,
      canSendWa && results.whatsapp?.provider === "console"
        ? "WhatsApp console mode"
        : null,
    ].filter(Boolean),
  };
}

module.exports = {
  expireTenantAndNotify,
  expireTenantIfNeeded,
  isPastExpiry,
  shouldAutoExpire,
  buildOwnerPayload,
  sendManualRenewalNotify,
};
