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

// ─── Nightly Report (11 PM BD time) ──────────────────────────────────────────
router.post("/nightly-report", async (_req, res) => {
  const { sendWhatsApp } = require("../services/whatsappService");

  try {
    // BD timezone offset = UTC+6
    const now = new Date();
    const bdOffset = 6 * 60 * 60 * 1000;
    const bdNow = new Date(now.getTime() + bdOffset);
    const bdDateStr = bdNow.toISOString().slice(0, 10);
    const dayName = bdNow.toLocaleDateString("en-BD", { weekday: "long", timeZone: "Asia/Dhaka" });

    const startOfDayBD = new Date(bdNow);
    startOfDayBD.setUTCHours(0, 0, 0, 0);
    const startOfDayUTC = new Date(startOfDayBD.getTime() - bdOffset);

    // Yesterday start (for comparison)
    const startOfYesterdayUTC = new Date(startOfDayUTC.getTime() - 86400000);

    const tenants = await prisma.tenant.findMany({
      where: { subscriptionStatus: { in: ["active", "trial"] } },
      select: { id: true, name: true, subscriptionExpiry: true, subscriptionPlan: true },
    });

    const results = [];

    for (const tenant of tenants) {
      try {
        const contact = await resolveTenantOwnerContact(prisma, tenant.id);
        const waPhone = contact?.whatsapp || contact?.phone;
        if (!waPhone) continue;

        const ownerName = contact?.ownerName || "Owner";

        // ── Fetch all stats in parallel ───────────────────────────────────
        const [
          todayBookings,
          yesterdayBookings,
          todayNewClients,
          totalClients,
          todayPayments,
          totalDue,
          openInquiries,
          overdueFollowUps,
          pendingInvoices,
          upcomingDepartures,
        ] = await Promise.all([
          // Today's new bookings
          prisma.booking.count({ where: { tenantId: tenant.id, createdAt: { gte: startOfDayUTC } } }),
          // Yesterday's bookings (for comparison)
          prisma.booking.count({ where: { tenantId: tenant.id, createdAt: { gte: startOfYesterdayUTC, lt: startOfDayUTC } } }),
          // New clients today
          prisma.client.count({ where: { tenantId: tenant.id, createdAt: { gte: startOfDayUTC } } }),
          // Total clients
          prisma.client.count({ where: { tenantId: tenant.id } }),
          // Today's payments received
          prisma.payment.aggregate({
            where: { tenantId: tenant.id, createdAt: { gte: startOfDayUTC } },
            _sum: { amount: true },
          }),
          // Total outstanding due
          prisma.invoice.aggregate({
            where: { tenantId: tenant.id, status: { notIn: ["paid", "cancelled"] } },
            _sum: { dueAmount: true },
          }),
          // Open inquiries (not yet converted)
          prisma.booking.count({ where: { tenantId: tenant.id, status: "inquiry" } }),
          // Overdue follow-ups (inquiry with followUpDate in the past)
          prisma.booking.count({
            where: {
              tenantId: tenant.id,
              status: "inquiry",
              followUpDate: { lt: startOfDayUTC },
            },
          }),
          // Unpaid invoices count
          prisma.invoice.count({ where: { tenantId: tenant.id, status: { in: ["unpaid", "partial"] } } }),
          // Bookings departing in next 3 days
          prisma.booking.count({
            where: {
              tenantId: tenant.id,
              departureDate: { gte: startOfDayUTC, lte: new Date(startOfDayUTC.getTime() + 3 * 86400000) },
              status: { in: ["confirmed", "processing"] },
            },
          }).catch(() => 0),
        ]);

        const todaySale = todayPayments._sum.amount || 0;
        const totalOutstanding = totalDue._sum.dueAmount || 0;

        // ── Trend arrow ───────────────────────────────────────────────────
        const bookingTrend = todayBookings > yesterdayBookings ? "📈" : todayBookings < yesterdayBookings ? "📉" : "➡️";

        // ── Subscription expiry warning ───────────────────────────────────
        let expiryWarning = "";
        if (tenant.subscriptionExpiry) {
          const daysLeft = Math.ceil((new Date(tenant.subscriptionExpiry).getTime() - now.getTime()) / 86400000);
          if (daysLeft <= 7 && daysLeft > 0) {
            expiryWarning = `\n⚠️ *Subscription expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}* — renew now to avoid disruption.`;
          } else if (daysLeft <= 0) {
            expiryWarning = `\n🚨 *Subscription EXPIRED* — please renew immediately.`;
          }
        }

        // ── Alerts section ────────────────────────────────────────────────
        const alerts = [];
        if (overdueFollowUps > 0) alerts.push(`🔴 ${overdueFollowUps} overdue follow-up${overdueFollowUps > 1 ? "s" : ""} — call today`);
        if (pendingInvoices > 0) alerts.push(`📄 ${pendingInvoices} unpaid invoice${pendingInvoices > 1 ? "s" : ""} pending`);
        if (upcomingDepartures > 0) alerts.push(`✈️ ${upcomingDepartures} departure${upcomingDepartures > 1 ? "s" : ""} in next 3 days`);
        if (openInquiries > 0) alerts.push(`💬 ${openInquiries} open inquir${openInquiries > 1 ? "ies" : "y"} — follow up`);
        const alertSection = alerts.length > 0 ? `\n\n⚡ *Action Needed:*\n${alerts.map(a => `  • ${a}`).join("\n")}` : "";

        // ── Build WhatsApp message ─────────────────────────────────────────
        const msg = [
          `🌙 *Good evening, ${ownerName}!*`,
          `📅 *${dayName}, ${bdDateStr}* — End of Day Report`,
          `━━━━━━━━━━━━━━━━━━━━━━`,
          ``,
          `🏢 *${tenant.name}*`,
          ``,
          `📋 *Today's Activity*`,
          `  • New Bookings: *${todayBookings}* ${bookingTrend} (vs ${yesterdayBookings} yesterday)`,
          `  • New Clients: *${todayNewClients}* (Total: ${totalClients})`,
          `  • Payments In: *৳${todaySale.toLocaleString("en-IN")}*`,
          ``,
          `💰 *Account Balance*`,
          `  • Outstanding Due: *৳${totalOutstanding.toLocaleString("en-IN")}*`,
          `  • Unpaid Invoices: *${pendingInvoices}*`,
          alertSection,
          expiryWarning,
          ``,
          `━━━━━━━━━━━━━━━━━━━━━━`,
          `🔗 Login: app.travelagencyweb.com`,
          `_Powered by Hearth ERP_`,
        ].filter(l => l !== null && l !== undefined).join("\n");

        const waResult = await sendWhatsApp({ to: waPhone, message: msg }).catch(e => ({ success: false, error: e.message }));

        results.push({
          tenant: tenant.name,
          phone: waPhone,
          whatsapp: waResult.success ? "sent" : "failed",
          stats: { todayBookings, todaySale, totalOutstanding, overdueFollowUps },
        });
      } catch (e) {
        results.push({ tenant: tenant.name, error: e.message });
      }
    }

    res.json({ sent: results.filter(r => r.whatsapp === "sent").length, total: results.length, results, date: bdDateStr });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;