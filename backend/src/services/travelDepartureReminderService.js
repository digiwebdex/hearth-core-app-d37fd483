const { notifyEvent } = require("./notificationService");
const { notifyTenantStaff } = require("../lib/staffInAppNotification");

const DEPARTURE_THRESHOLDS = [3, 2, 1];

function daysUntil(fromIso, toIso) {
  const from = new Date(fromIso);
  from.setHours(0, 0, 0, 0);
  const to = new Date(toIso);
  to.setHours(0, 0, 0, 0);
  return Math.round((to - from) / 86400000);
}

async function alreadySentToday(prisma, tenantId, bookingId, daysLeft) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const existing = await prisma.auditLog.findFirst({
    where: {
      tenantId,
      module: "bookings",
      action: `departure_reminder_${daysLeft}`,
      targetId: bookingId,
      createdAt: { gte: startOfDay },
    },
  }).catch(() => null);
  return Boolean(existing);
}

async function processTravelDepartureReminders(prisma) {
  if (process.env.TRAVEL_REMINDER_ENABLED === "false") {
    return { sent: 0, skipped: 0, disabled: true };
  }

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  const bookings = await prisma.booking.findMany({
    where: {
      travelDateFrom: { not: null },
      status: { in: ["confirmed", "ticketed", "traveling", "pending"] },
    },
    include: {
      client: { select: { name: true, phone: true, email: true } },
      tenant: { select: { name: true } },
    },
  });

  let sent = 0;
  let skipped = 0;

  for (const booking of bookings) {
    const travelDate = String(booking.travelDateFrom || "").slice(0, 10);
    if (!travelDate || travelDate < todayIso) {
      skipped += 1;
      continue;
    }

    const daysLeft = daysUntil(todayIso, travelDate);
    if (!DEPARTURE_THRESHOLDS.includes(daysLeft)) {
      skipped += 1;
      continue;
    }

    if (await alreadySentToday(prisma, booking.tenantId, booking.id, daysLeft)) {
      skipped += 1;
      continue;
    }

    const clientName = booking.client?.name || booking.clientName || "Traveler";
    const clientPhone = booking.client?.phone || null;
    const clientEmail = booking.client?.email || null;

    if (!clientPhone && !clientEmail) {
      skipped += 1;
      continue;
    }

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
      title: "Upcoming departure",
      message: `${clientName} departs ${travelDate}${booking.destination ? ` to ${booking.destination}` : ""} (${daysLeft} day${daysLeft === 1 ? "" : "s"}).`,
      link: `/bookings/${booking.id}`,
    });

    await prisma.auditLog.create({
      data: {
        actorId: "system",
        actorName: "Travel Reminder Cron",
        actorEmail: "system",
        actorRole: "system",
        tenantId: booking.tenantId,
        tenantName: booking.tenant?.name || null,
        module: "bookings",
        action: `departure_reminder_${daysLeft}`,
        targetType: "booking",
        targetId: booking.id,
        targetLabel: booking.title || booking.id,
        metadata: { daysLeft, travelDate },
      },
    }).catch(() => {});

    sent += 1;
  }

  return { sent, skipped, total: bookings.length };
}

module.exports = { processTravelDepartureReminders, DEPARTURE_THRESHOLDS };
