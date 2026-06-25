/**
 * Trial onboarding drip — SMS + email on trial day 1, day 2, and last day.
 * Idempotent via auditLog (one send per drip type per tenant).
 */
const { getTrialDays } = require("../lib/trialConfig");
const { resolveTenantOwnerContact } = require("../lib/tenantOwnerContact");
const { notifyEvent } = require("./notificationService");

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function trialDayNumber(createdAt) {
  const start = startOfDay(createdAt);
  const today = startOfDay();
  return Math.floor((today.getTime() - start.getTime()) / 86400000) + 1;
}

function daysUntilExpiry(expiry) {
  if (!expiry) return null;
  const end = startOfDay(expiry);
  const today = startOfDay();
  return Math.round((end.getTime() - today.getTime()) / 86400000);
}

const DRIP_CONFIG = [
  { key: "day1", dayNum: 1, action: "trial_drip_day1_sent", event: "trial_drip_day1" },
  { key: "day2", dayNum: 2, action: "trial_drip_day2_sent", event: "trial_drip_day2" },
  { key: "last", action: "trial_drip_last_sent", event: "trial_drip_last", isLast: true },
];

async function wasDripSent(prisma, tenantId, action) {
  const row = await prisma.auditLog.findFirst({
    where: { tenantId, module: "subscription", action },
    select: { id: true },
  });
  return Boolean(row);
}

async function processTrialDrips(prisma) {
  if (String(process.env.TRIAL_DRIP_ENABLED || "true").toLowerCase() === "false") {
    return { sent: 0, skipped: 0, reason: "disabled" };
  }

  const trialDays = getTrialDays();
  const tenants = await prisma.tenant.findMany({
    where: { subscriptionStatus: "trial" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      subscriptionExpiry: true,
      subscriptionPlan: true,
    },
  });

  let sent = 0;
  let skipped = 0;

  for (const tenant of tenants) {
    const dayNum = trialDayNumber(tenant.createdAt);
    const daysLeft = daysUntilExpiry(tenant.subscriptionExpiry);

    for (const drip of DRIP_CONFIG) {
      let shouldSend = false;
      if (drip.isLast) {
        shouldSend = daysLeft === 0 || daysLeft === 1;
      } else {
        shouldSend = dayNum === drip.dayNum;
      }
      if (!shouldSend) continue;

      if (await wasDripSent(prisma, tenant.id, drip.action)) {
        skipped += 1;
        continue;
      }

      const contact = await resolveTenantOwnerContact(prisma, tenant.id);
      if (!contact?.ownerEmail && !contact?.phone) {
        skipped += 1;
        continue;
      }

      await notifyEvent(drip.event, {
        tenantName: tenant.name,
        ownerName: contact.ownerName,
        ownerEmail: contact.ownerEmail,
        ownerPhone: contact.phone,
        ownerWhatsapp: contact.whatsapp,
        plan: tenant.subscriptionPlan || "pro",
        trialDays,
        trialDay: dayNum,
        daysLeft: daysLeft ?? 0,
        expiryDate: tenant.subscriptionExpiry?.toISOString().slice(0, 10) || "",
      }).catch((err) => console.error(`[trial-drip] ${drip.event}:`, err.message));

      await prisma.auditLog.create({
        data: {
          actorId: "system",
          actorName: "Trial Drip Cron",
          actorEmail: "system",
          actorRole: "system",
          tenantId: tenant.id,
          tenantName: tenant.name,
          module: "subscription",
          action: drip.action,
          targetType: "tenant",
          targetId: tenant.id,
          targetLabel: tenant.name,
          newValue: JSON.stringify({ trialDay: dayNum, daysLeft, trialDays }),
        },
      }).catch(() => {});

      sent += 1;
    }
  }

  return { sent, skipped, tenantsChecked: tenants.length };
}

module.exports = { processTrialDrips, trialDayNumber, daysUntilExpiry };
