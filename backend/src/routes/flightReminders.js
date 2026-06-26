const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");
const { processTravelDepartureReminders } = require("../services/travelDepartureReminderService");
const { notifyEvent } = require("../services/notificationService");
const { notifyTenantStaff } = require("../lib/staffInAppNotification");

router.use(authenticate);

// GET /api/flight-reminders/upcoming — bookings departing in next N days
router.get("/upcoming", requirePermission("bookings", "view"), async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 90);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const future = new Date(today);
    future.setDate(future.getDate() + days);
    const todayIso = today.toISOString().slice(0, 10);
    const futureIso = future.toISOString().slice(0, 10);

    const bookings = await prisma.booking.findMany({
      where: {
        tenantId: req.tenantId,
        travelDateFrom: { gte: todayIso, lte: futureIso },
        status: { in: ["confirmed", "ticketed", "traveling", "pending"] },
      },
      include: { client: { select: { name: true, phone: true, email: true } } },
      orderBy: { travelDateFrom: "asc" },
    });

    // Fetch sent reminder logs for these bookings
    const bookingIds = bookings.map(b => b.id);
    const logs = bookingIds.length ? await prisma.auditLog.findMany({
      where: {
        tenantId: req.tenantId,
        module: "bookings",
        action: { startsWith: "departure_reminder_" },
        targetId: { in: bookingIds },
      },
      select: { targetId: true, action: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }) : [];

    // Group logs by bookingId
    const logMap = {};
    for (const log of logs) {
      if (!logMap[log.targetId]) logMap[log.targetId] = {};
      const daysLeft = log.action.replace("departure_reminder_", "");
      if (!logMap[log.targetId][daysLeft]) {
        logMap[log.targetId][daysLeft] = log.createdAt;
      }
    }

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    const result = bookings.map(b => {
      const tDate = new Date(b.travelDateFrom);
      tDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.round((tDate - todayDate) / 86400000);
      return {
        id: b.id,
        title: b.title,
        clientName: b.client?.name || b.clientName || null,
        clientPhone: b.client?.phone || null,
        clientEmail: b.client?.email || null,
        destination: b.destination,
        travelDateFrom: b.travelDateFrom,
        daysUntil,
        status: b.status,
        remindersSent: logMap[b.id] || {},
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/flight-reminders/send/:bookingId — manual send
router.post("/send/:bookingId", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const booking = await prisma.booking.findFirst({
      where: { id: req.params.bookingId, tenantId: req.tenantId },
      include: {
        client: { select: { name: true, phone: true, email: true } },
        tenant: { select: { name: true } },
      },
    });
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const clientName = booking.client?.name || booking.clientName || "Traveler";
    const clientPhone = booking.client?.phone || req.body.phone || null;
    const clientEmail = booking.client?.email || req.body.email || null;

    if (!clientPhone && !clientEmail) {
      return res.status(400).json({ message: "No contact info available for this client" });
    }

    const travelDate = String(booking.travelDateFrom || "").slice(0, 10);
    const todayIso = new Date().toISOString().slice(0, 10);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tDate = new Date(travelDate); tDate.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((tDate - today) / 86400000);

    await notifyEvent("travel_departure_reminder", {
      clientName,
      clientPhone,
      clientEmail,
      destination: booking.destination || booking.title || null,
      travelDate,
      daysLeft,
      bookingTitle: booking.title || null,
      companyName: booking.tenant?.name || "Travel Agency",
    }).catch(() => {});

    await notifyTenantStaff(prisma, {
      tenantId: req.tenantId,
      type: "travel_departure_reminder",
      title: "Manual reminder sent",
      message: `Reminder sent to ${clientName} for departure on ${travelDate}.`,
      link: `/bookings/${booking.id}`,
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.user?.id || "staff",
        actorName: req.user?.name || "Staff",
        actorEmail: req.user?.email || "staff",
        actorRole: req.user?.role || "staff",
        tenantId: req.tenantId,
        tenantName: booking.tenant?.name || null,
        module: "bookings",
        action: `departure_reminder_manual`,
        targetType: "booking",
        targetId: booking.id,
        targetLabel: booking.title || booking.id,
        metadata: { daysLeft, travelDate, manual: true },
      },
    }).catch(() => {});

    res.json({ success: true, clientName, daysLeft, travelDate });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/flight-reminders/run-now — manually trigger the cron job for this tenant
router.post("/run-now", requirePermission("bookings", "edit"), async (req, res) => {
  try {
    const result = await processTravelDepartureReminders(prisma);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
