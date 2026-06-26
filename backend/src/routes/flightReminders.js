const router = require("express").Router();
const { prisma, authenticate, requireRole } = require("../middleware/auth");
const { processTravelDepartureReminders } = require("../services/travelDepartureReminderService");

// GET /api/flight-reminders/upcoming?days=7
// Returns bookings departing within N days, with today's reminder-sent status
router.get("/upcoming", authenticate, async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 30);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const until = new Date(today);
    until.setDate(until.getDate() + days);

    const bookings = await prisma.booking.findMany({
      where: {
        tenantId: req.user.tenantId,
        travelDateFrom: { gte: today, lte: until },
        status: { in: ["confirmed", "ticketed", "traveling", "pending"] },
      },
      include: {
        client: { select: { id: true, name: true, phone: true, email: true } },
      },
      orderBy: { travelDateFrom: "asc" },
    });

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const results = await Promise.all(
      bookings.map(async (b) => {
        const travelDate = String(b.travelDateFrom || "").slice(0, 10);
        const todayIso = today.toISOString().slice(0, 10);
        const msPerDay = 86400000;
        const daysLeft = Math.round((new Date(travelDate) - new Date(todayIso)) / msPerDay);

        const sentLog = await prisma.auditLog.findFirst({
          where: {
            tenantId: req.user.tenantId,
            module: "bookings",
            action: `departure_reminder_${daysLeft}`,
            targetId: b.id,
            createdAt: { gte: startOfDay },
          },
        }).catch(() => null);

        return {
          id: b.id,
          title: b.title,
          destination: b.destination,
          travelDateFrom: b.travelDateFrom,
          daysLeft,
          status: b.status,
          client: b.client || { name: b.clientName, phone: null, email: null },
          reminderSentToday: Boolean(sentLog),
        };
      })
    );

    res.json({ bookings: results, days });
  } catch (err) {
    console.error("flight-reminders/upcoming:", err);
    res.status(500).json({ message: "Failed to fetch upcoming reminders" });
  }
});

// POST /api/flight-reminders/send/:bookingId
// Manual one-time reminder for a specific booking
router.post("/send/:bookingId", authenticate, async (req, res) => {
  try {
    const booking = await prisma.booking.findFirst({
      where: { id: req.params.bookingId, tenantId: req.user.tenantId },
      include: {
        client: { select: { name: true, phone: true, email: true } },
        tenant: { select: { name: true } },
      },
    });
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const { notifyEvent } = require("../services/notificationService");
    const { notifyTenantStaff } = require("../lib/staffInAppNotification");

    const travelDate = String(booking.travelDateFrom || "").slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const msPerDay = 86400000;
    const daysLeft = Math.round((new Date(travelDate) - new Date(today)) / msPerDay);

    const clientName = booking.client?.name || booking.clientName || "Traveler";
    const clientPhone = booking.client?.phone || null;
    const clientEmail = booking.client?.email || null;

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
      tenantId: booking.tenantId,
      type: "travel_departure_reminder",
      title: "Manual departure reminder sent",
      message: `Reminder sent for ${clientName} departing ${travelDate}${booking.destination ? ` to ${booking.destination}` : ""}.`,
      link: `/bookings/${booking.id}`,
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        actorName: req.user.name || req.user.email,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        tenantId: req.user.tenantId,
        module: "bookings",
        action: `departure_reminder_manual`,
        targetType: "booking",
        targetId: booking.id,
        targetLabel: booking.title || booking.id,
        metadata: { daysLeft, travelDate },
      },
    }).catch(() => {});

    res.json({ success: true, message: "Reminder sent" });
  } catch (err) {
    console.error("flight-reminders/send:", err);
    res.status(500).json({ message: "Failed to send reminder" });
  }
});

// POST /api/flight-reminders/run-now  (admin/owner only)
router.post("/run-now", authenticate, requireRole("super_admin", "tenant_owner"), async (req, res) => {
  try {
    const result = await processTravelDepartureReminders(prisma);
    res.json(result);
  } catch (err) {
    console.error("flight-reminders/run-now:", err);
    res.status(500).json({ message: "Failed to run reminder job" });
  }
});

module.exports = router;
