const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");

router.use(authenticate);

const VALID_STATUSES = new Set(["open", "assigned", "in_progress", "resolved", "closed"]);
const VALID_PRIORITIES = new Set(["low", "medium", "high", "urgent"]);

async function nextTicketNumber(tenantId) {
  const count = await prisma.supportTicket.count({ where: { tenantId } });
  return `ST-${String(count + 1).padStart(4, "0")}`;
}

async function enrichTickets(tickets) {
  const assigneeIds = [...new Set(tickets.map((t) => t.assignedTo).filter(Boolean))];
  const creatorIds = [...new Set(tickets.map((t) => t.createdBy).filter(Boolean))];
  const userIds = [...new Set([...assigneeIds, ...creatorIds])];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  return tickets.map((ticket) => ({
    ...ticket,
    assigneeName: ticket.assignedTo ? userMap[ticket.assignedTo]?.name || "" : "",
    creatorName: ticket.createdBy ? userMap[ticket.createdBy]?.name || "" : "",
    clientName: ticket.client?.name || "",
    clientPhone: ticket.client?.phone || "",
  }));
}

router.get("/", requirePermission("tasks", "view"), async (req, res) => {
  try {
    const where = { tenantId: req.tenantId };
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.assignedTo) where.assignedTo = String(req.query.assignedTo);
    if (req.query.clientId) where.clientId = String(req.query.clientId);

    const tickets = await prisma.supportTicket.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, phone: true, email: true } },
        booking: { select: { id: true, title: true, type: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(await enrichTickets(tickets));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", requirePermission("tasks", "view"), async (req, res) => {
  try {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        client: { select: { id: true, name: true, phone: true, email: true } },
        booking: { select: { id: true, title: true, type: true } },
      },
    });
    if (!ticket) return res.status(404).json({ message: "Not found" });
    const [enriched] = await enrichTickets([ticket]);
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", requirePermission("tasks", "create"), async (req, res) => {
  try {
    const subject = String(req.body.subject || "").trim();
    if (!subject) return res.status(400).json({ message: "Subject is required" });

    const priority = VALID_PRIORITIES.has(req.body.priority) ? req.body.priority : "medium";
    const status = "open";
    const ticketNumber = await nextTicketNumber(req.tenantId);

    const ticket = await prisma.supportTicket.create({
      data: {
        tenantId: req.tenantId,
        ticketNumber,
        subject,
        description: String(req.body.description || "").trim(),
        priority,
        category: String(req.body.category || "general").trim() || "general",
        source: String(req.body.source || "internal").trim() || "internal",
        clientId: req.body.clientId || null,
        bookingId: req.body.bookingId || null,
        assignedTo: req.body.assignedTo || null,
        createdBy: req.userId,
        status: req.body.assignedTo ? "assigned" : status,
      },
      include: {
        client: { select: { id: true, name: true, phone: true, email: true } },
        booking: { select: { id: true, title: true, type: true } },
      },
    });
    const [enriched] = await enrichTickets([ticket]);
    res.status(201).json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/:id", requirePermission("tasks", "edit"), async (req, res) => {
  try {
    const existing = await prisma.supportTicket.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!existing) return res.status(404).json({ message: "Not found" });

    const data = {};
    if (req.body.subject !== undefined) data.subject = String(req.body.subject).trim();
    if (req.body.description !== undefined) data.description = String(req.body.description).trim();
    if (req.body.priority !== undefined && VALID_PRIORITIES.has(req.body.priority)) {
      data.priority = req.body.priority;
    }
    if (req.body.category !== undefined) data.category = String(req.body.category).trim() || "general";
    if (req.body.source !== undefined) data.source = String(req.body.source).trim() || "internal";
    if (req.body.clientId !== undefined) data.clientId = req.body.clientId || null;
    if (req.body.bookingId !== undefined) data.bookingId = req.body.bookingId || null;
    if (req.body.status !== undefined && VALID_STATUSES.has(req.body.status)) {
      data.status = req.body.status;
      if (req.body.status === "resolved" || req.body.status === "closed") {
        data.resolvedAt = new Date();
      }
    }
    if (req.body.resolutionNotes !== undefined) data.resolutionNotes = String(req.body.resolutionNotes).trim() || null;

    const ticket = await prisma.supportTicket.update({
      where: { id: req.params.id },
      data,
      include: {
        client: { select: { id: true, name: true, phone: true, email: true } },
        booking: { select: { id: true, title: true, type: true } },
      },
    });
    const [enriched] = await enrichTickets([ticket]);
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/:id/assign", requirePermission("tasks", "edit"), async (req, res) => {
  try {
    const existing = await prisma.supportTicket.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!existing) return res.status(404).json({ message: "Not found" });

    const assignedTo = req.body.assignedTo || null;
    const ticket = await prisma.supportTicket.update({
      where: { id: req.params.id },
      data: {
        assignedTo,
        status: assignedTo ? "assigned" : "open",
      },
      include: {
        client: { select: { id: true, name: true, phone: true, email: true } },
        booking: { select: { id: true, title: true, type: true } },
      },
    });
    const [enriched] = await enrichTickets([ticket]);
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/:id/resolve", requirePermission("tasks", "edit"), async (req, res) => {
  try {
    const existing = await prisma.supportTicket.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!existing) return res.status(404).json({ message: "Not found" });

    const ticket = await prisma.supportTicket.update({
      where: { id: req.params.id },
      data: {
        status: "resolved",
        resolutionNotes: String(req.body.resolutionNotes || "").trim() || existing.resolutionNotes,
        resolvedAt: new Date(),
      },
      include: {
        client: { select: { id: true, name: true, phone: true, email: true } },
        booking: { select: { id: true, title: true, type: true } },
      },
    });
    const [enriched] = await enrichTickets([ticket]);
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", requirePermission("tasks", "delete"), async (req, res) => {
  try {
    const result = await prisma.supportTicket.deleteMany({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
