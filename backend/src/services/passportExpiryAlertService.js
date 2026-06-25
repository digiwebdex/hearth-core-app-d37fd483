const { notifyEvent } = require("./notificationService");
const { notifyTenantStaff } = require("../lib/staffInAppNotification");

const ALERT_THRESHOLDS = [30, 14, 7, 3, 1];

function parseDate(value) {
  if (!value) return null;
  const d = new Date(String(value).slice(0, 10));
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysUntil(from, to) {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  return Math.round((end - start) / 86400000);
}

async function alreadySentToday(prisma, tenantId, clientId, daysLeft) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const existing = await prisma.auditLog.findFirst({
    where: {
      tenantId,
      module: "clients",
      action: `passport_expiry_alert_${daysLeft}`,
      targetId: clientId,
      createdAt: { gte: startOfDay },
    },
  }).catch(() => null);
  return Boolean(existing);
}

async function processPassportExpiryAlerts(prisma) {
  if (process.env.PASSPORT_ALERT_ENABLED === "false") {
    return { sent: 0, skipped: 0, disabled: true };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const clients = await prisma.client.findMany({
    where: { passportExpiry: { not: null } },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      passportNumber: true,
      passportExpiry: true,
      tenantId: true,
      tenant: { select: { name: true } },
    },
  });

  let sent = 0;
  let skipped = 0;

  for (const client of clients) {
    const expiry = parseDate(client.passportExpiry);
    if (!expiry || expiry < today) {
      skipped += 1;
      continue;
    }

    const daysLeft = daysUntil(today, expiry);
    if (!ALERT_THRESHOLDS.includes(daysLeft)) {
      skipped += 1;
      continue;
    }

    if (await alreadySentToday(prisma, client.tenantId, client.id, daysLeft)) {
      skipped += 1;
      continue;
    }

    await notifyEvent("passport_expiry_alert", {
      clientName: client.name,
      clientPhone: client.phone || null,
      clientEmail: client.email || null,
      passportNumber: client.passportNumber || null,
      expiryDate: client.passportExpiry,
      daysLeft,
      companyName: client.tenant?.name || "Travel Agency",
      tenantName: client.tenant?.name || null,
    }).catch(() => {});

    await notifyTenantStaff(prisma, {
      tenantId: client.tenantId,
      type: "passport_expiry_alert",
      title: "Passport expiring soon",
      message: `${client.name}'s passport expires on ${client.passportExpiry} (${daysLeft} days left).`,
      link: `/clients/${client.id}`,
    });

    await prisma.auditLog.create({
      data: {
        actorId: "system",
        actorName: "Passport Alert Cron",
        actorEmail: "system",
        actorRole: "system",
        tenantId: client.tenantId,
        tenantName: client.tenant?.name || null,
        module: "clients",
        action: `passport_expiry_alert_${daysLeft}`,
        targetType: "client",
        targetId: client.id,
        targetLabel: client.name,
        metadata: { daysLeft, passportExpiry: client.passportExpiry },
      },
    }).catch(() => {});

    sent += 1;
  }

  return { sent, skipped, total: clients.length };
}

module.exports = { processPassportExpiryAlerts, ALERT_THRESHOLDS };
