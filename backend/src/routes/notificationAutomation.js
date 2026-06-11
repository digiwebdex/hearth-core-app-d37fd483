const router = require("express").Router();
const { requireRole, prisma } = require("../middleware/auth");
const {
  AUTOMATION_EVENTS,
  ensureTenantSettings,
  formatSettingsResponse,
  formatDeliveryListItem,
} = require("../services/tenantAutomationService");

const EVENT_LABELS = {
  lead_created: "Lead Created",
  booking_created: "Booking Created",
  payment_received: "Payment Received",
};

function formatAutomationResponse(settings, events) {
  return {
    settings: formatSettingsResponse(settings),
    events: AUTOMATION_EVENTS.map((eventType) => {
      const row = events.find((e) => e.eventType === eventType);
      return {
        eventType,
        label: EVENT_LABELS[eventType] || eventType,
        sms: row?.sms ?? true,
        inApp: row?.inApp ?? true,
      };
    }),
  };
}

router.get("/", async (req, res) => {
  try {
    const { settings, events } = await ensureTenantSettings(req.tenantId);
    res.json(formatAutomationResponse(settings, events));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/", requireRole("tenant_owner"), async (req, res) => {
  try {
    const body = req.body || {};
    const { settings, events } = await ensureTenantSettings(req.tenantId);

    if (body.settings) {
      const allowed = ["smsEnabled", "notifyOnBooking", "notifyOnPayment", "notifyOnLead"];
      const data = {};
      for (const key of allowed) {
        if (body.settings[key] !== undefined) data[key] = Boolean(body.settings[key]);
      }
      if (Object.keys(data).length) {
        await prisma.smsSettings.update({ where: { tenantId: req.tenantId }, data });
      }
    }

    if (Array.isArray(body.events)) {
      for (const item of body.events) {
        if (!AUTOMATION_EVENTS.includes(item.eventType)) {
          return res.status(400).json({ message: `Unknown eventType: ${item.eventType}` });
        }
        const data = {};
        if (item.sms !== undefined) data.sms = Boolean(item.sms);
        if (item.inApp !== undefined) data.inApp = Boolean(item.inApp);
        if (Object.keys(data).length) {
          await prisma.notificationAutomation.updateMany({
            where: { tenantId: req.tenantId, eventType: item.eventType },
            data,
          });
        }
      }
    }

    const refreshed = await ensureTenantSettings(req.tenantId);
    res.json(formatAutomationResponse(refreshed.settings, refreshed.events));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/logs/stats", async (req, res) => {
  try {
    const where = { tenantId: req.tenantId };
    const [total, sent, failed, pending, bySms, byInApp] = await Promise.all([
      prisma.notificationDelivery.count({ where }),
      prisma.notificationDelivery.count({ where: { ...where, status: "sent" } }),
      prisma.notificationDelivery.count({ where: { ...where, status: "failed" } }),
      prisma.notificationDelivery.count({ where: { ...where, status: "pending" } }),
      prisma.notificationDelivery.count({ where: { ...where, channel: "sms" } }),
      prisma.notificationDelivery.count({ where: { ...where, channel: "in_app" } }),
    ]);
    res.json({ total, sent, failed, pending, bySms, byInApp });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/logs", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "20", 10)));
    const skip = (page - 1) * limit;

    const where = { tenantId: req.tenantId };
    if (req.query.status) where.status = req.query.status;
    if (req.query.channel) where.channel = req.query.channel;
    if (req.query.eventType) where.eventType = req.query.eventType;
    if (req.query.search) {
      where.OR = [
        { recipient: { contains: req.query.search, mode: "insensitive" } },
        { recipientName: { contains: req.query.search, mode: "insensitive" } },
        { message: { contains: req.query.search, mode: "insensitive" } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.notificationDelivery.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.notificationDelivery.count({ where }),
    ]);

    res.json({ items: rows.map(formatDeliveryListItem), total, page, limit });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/logs/:id", async (req, res) => {
  try {
    const row = await prisma.notificationDelivery.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json(row);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
