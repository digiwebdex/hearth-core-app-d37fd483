// Cron-safe subscription/trial expiry processing
// Protected by CRON_SECRET env var — not by JWT
const router = require("express").Router();
const { prisma } = require("../middleware/auth");
const { notifyEvent } = require("../services/notificationService");
const { resolveTenantOwnerContact } = require("../lib/tenantOwnerContact");
const { expireTenantAndNotify } = require("../services/subscriptionExpiryService");
const { processTrialDrips } = require("../services/trialDripService");
const { processPassportExpiryAlerts } = require("../services/passportExpiryAlertService");
const { processTravelDepartureReminders } = require("../services/travelDepartureReminderService");

const CRON_SECRET = process.env.CRON_SECRET || "";

function verifyCronSecret(req, res, next) {
  const token = req.headers["x-cron-secret"] || req.query.secret;
  if (!CRON_SECRET || CRON_SECRET.length < 8) return res.status(500).json({ message: "CRON_SECRET not configured" });
  if (token !== CRON_SECRET) return res.status(401).json({ message: "Invalid cron secret" });
  next();
}

router.use(verifyCronSecret);

async function getTenantOwnerContact(tenantId) {
  const contact = await resolveTenantOwnerContact(prisma, tenantId);
  if (!contact) return null;
  return {
    name: contact.ownerName,
    email: contact.ownerEmail,
    phone: contact.phone,
    whatsapp: contact.whatsapp,
  };
}

router.post("/process-expiry", async (_req, res) => {
  try {
    const now = new Date();
    const nowIso = now.toISOString();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const reminderWindowEnd = new Date(now);
    reminderWindowEnd.setDate(reminderWindowEnd.getDate() + 3);

    const expiringSoonTenants = await prisma.tenant.findMany({
      where: {
        subscriptionExpiry: { gte: now, lte: reminderWindowEnd },
        subscriptionStatus: { in: ["active", "trial"] },
      },
      select: { id: true, name: true, subscriptionPlan: true, subscriptionStatus: true, subscriptionExpiry: true },
    });

    let remindersSent = 0;
    for (const tenant of expiringSoonTenants) {
      const existingReminder = await prisma.auditLog.findFirst({
        where: {
          tenantId: tenant.id,
          module: "subscription",
          action: "subscription_expiring_reminder_sent",
          createdAt: { gte: startOfDay },
        },
      }).catch(() => null);
      if (existingReminder) continue;

      const owner = await getTenantOwnerContact(tenant.id);
      await notifyEvent("subscription_expiring", {
        tenantName: tenant.name,
        ownerEmail: owner?.email || null,
        ownerPhone: owner?.phone || null,
        ownerWhatsapp: owner?.whatsapp || null,
        ownerName: owner?.name || null,
        plan: tenant.subscriptionPlan,
        expiryDate: tenant.subscriptionExpiry?.toISOString().slice(0, 10),
      }).catch(() => {});

      await prisma.auditLog.create({
        data: {
          actorId: "system",
          actorName: "System Cron",
          actorEmail: "system",
          actorRole: "system",
          tenantId: tenant.id,
          tenantName: tenant.name,
          module: "subscription",
          action: "subscription_expiring_reminder_sent",
          targetType: "tenant",
          targetId: tenant.id,
          targetLabel: tenant.name,
          newValue: JSON.stringify({ plan: tenant.subscriptionPlan, expiry: tenant.subscriptionExpiry?.toISOString() }),
        },
      }).catch(() => {});
      remindersSent += 1;
    }

    const expiredTenants = await prisma.tenant.findMany({
      where: {
        subscriptionExpiry: { lt: now },
        subscriptionStatus: { in: ["active", "trial"] },
      },
      select: { id: true, name: true, subscriptionPlan: true, subscriptionStatus: true, subscriptionExpiry: true },
    });

    let processed = 0;
    for (const tenant of expiredTenants) {
      const result = await expireTenantAndNotify(prisma, tenant);
      if (result.expired) processed += 1;
    }

    const trialDrip = await processTrialDrips(prisma).catch((err) => {
      console.error("[cron] trial drip:", err.message);
      return { sent: 0, skipped: 0, error: err.message };
    });

    const passportAlerts = await processPassportExpiryAlerts(prisma).catch((err) => {
      console.error("[cron] passport alerts:", err.message);
      return { sent: 0, skipped: 0, error: err.message };
    });

    const travelReminders = await processTravelDepartureReminders(prisma).catch((err) => {
      console.error("[cron] travel reminders:", err.message);
      return { sent: 0, skipped: 0, error: err.message };
    });

    const scheduledSubscriptions = await prisma.subscription.findMany({
      where: { status: "scheduled", startDate: { lte: now } },
      orderBy: { createdAt: "asc" },
    }).catch(() => []);

    let scheduledActivated = 0;
    for (const subscription of scheduledSubscriptions) {
      const tenant = await prisma.tenant.findUnique({ where: { id: subscription.tenantId }, select: { id: true, name: true, subscriptionPlan: true, subscriptionStatus: true, subscriptionExpiry: true } });
      if (!tenant) continue;
      const expiryDate = new Date(subscription.endDate);
      await prisma.tenant.update({ where: { id: tenant.id }, data: { subscriptionPlan: subscription.plan, subscriptionStatus: "active", subscriptionExpiry: expiryDate } });
      await prisma.subscription.update({ where: { id: subscription.id }, data: { status: "active" } }).catch(() => {});
      if (prisma.subscriptionHistory) {
        await prisma.subscriptionHistory.create({
          data: {
            tenantId: tenant.id,
            oldPlan: tenant.subscriptionPlan,
            newPlan: subscription.plan,
            oldStatus: tenant.subscriptionStatus,
            newStatus: "active",
            billingCycle: subscription.billingCycle || "monthly",
            activationDate: new Date(subscription.startDate),
            expiryDate,
            actionType: "scheduled_activation_applied",
            source: "system_expiry",
            note: subscription.note || null,
            actorUserId: "system",
          },
        }).catch(() => {});
      }
      await prisma.auditLog.create({
        data: {
          actorId: "system",
          actorName: "System Cron",
          actorEmail: "system",
          actorRole: "system",
          tenantId: tenant.id,
          tenantName: tenant.name,
          module: "subscription",
          action: "scheduled_subscription_activated",
          targetType: "subscription",
          targetId: subscription.id,
          targetLabel: subscription.plan,
          oldValue: JSON.stringify({ plan: tenant.subscriptionPlan, status: tenant.subscriptionStatus, expiry: tenant.subscriptionExpiry }),
          newValue: JSON.stringify({ plan: subscription.plan, status: "active", expiry: expiryDate.toISOString() }),
        },
      }).catch(() => {});

      const owner = await getTenantOwnerContact(tenant.id);
      await notifyEvent("subscription_activated", {
        ownerEmail: owner?.email || null,
        ownerPhone: owner?.phone || null,
        ownerName: owner?.name || null,
        plan: subscription.plan,
        expiryDate: expiryDate.toISOString().slice(0, 10),
      }).catch(() => {});

      scheduledActivated += 1;
    }

    res.json({
      processed,
      remindersSent,
      scheduledActivated,
      trialDrip,
      passportAlerts,
      travelReminders,
      total: expiredTenants.length,
      totalScheduled: scheduledSubscriptions.length,
      totalExpiringSoon: expiringSoonTenants.length,
      timestamp: nowIso,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Nightly Report (11 PM) ────────────────────────────────────────────────
router.post("/nightly-report", async (_req, res) => {
  const { sendSms } = require("../services/smsService");
  const { sendWhatsApp } = require("../services/whatsappService");

  try {
    const today = new Date();
    const startOfDay = new Date(today); startOfDay.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString().slice(0, 10);

    // All active tenants
    const tenants = await prisma.tenant.findMany({
      where: { subscriptionStatus: { in: ["active", "trial"] } },
      select: { id: true, name: true },
    });

    const results = [];
    for (const tenant of tenants) {
      try {
        const contact = await resolveTenantOwnerContact(prisma, tenant.id);
        const phone = contact?.phone;
        if (!phone) continue;

        // Gather stats
        const [clients, bookings, todayBookings, invoiceAgg, todayRevenue] = await Promise.all([
          prisma.client.count({ where: { tenantId: tenant.id } }),
          prisma.booking.count({ where: { tenantId: tenant.id } }),
          prisma.booking.count({ where: { tenantId: tenant.id, createdAt: { gte: startOfDay } } }),
          prisma.invoice.aggregate({
            where: { tenantId: tenant.id },
            _sum: { totalAmount: true, paidAmount: true, dueAmount: true },
          }),
          prisma.payment.aggregate({
            where: { tenantId: tenant.id, createdAt: { gte: startOfDay } },
            _sum: { amount: true },
          }),
        ]);

        const totalRevenue = invoiceAgg._sum.paidAmount || 0;
        const totalDue = invoiceAgg._sum.dueAmount || 0;
        const todayIncome = todayRevenue._sum.amount || 0;

        const msg =
          `📊 *${tenant.name}* — Daily Report ${todayIso}\n` +
          `👥 Clients: ${clients} | 📋 Bookings: ${bookings} (+${todayBookings} today)\n` +
          `💰 Collected: ৳${totalRevenue.toLocaleString()} | Due: ৳${totalDue.toLocaleString()}\n` +
          `🏦 Today Income: ৳${todayIncome.toLocaleString()}`;

        const smsMsg =
          `[${tenant.name}] ${todayIso}: ` +
          `Clients:${clients} Bookings:${bookings}(+${todayBookings}) ` +
          `Collected:${totalRevenue} Due:${totalDue} Today:${todayIncome}`;

        const [smsRes, waRes] = await Promise.allSettled([
          sendSms({ to: phone, message: smsMsg }),
          sendWhatsApp({ to: phone, message: msg }),
        ]);

        results.push({
          tenant: tenant.name,
          phone,
          sms: smsRes.status === "fulfilled" ? "sent" : "failed",
          whatsapp: waRes.status === "fulfilled" ? "sent" : "failed",
        });
      } catch (e) {
        results.push({ tenant: tenant.name, error: e.message });
      }
    }

    res.json({ sent: results.length, results, timestamp: today.toISOString() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;