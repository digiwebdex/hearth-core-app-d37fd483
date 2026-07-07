// Customer Portal — additional customer-facing endpoints (Visa status + Support
// tickets + Live Chat), mounted at the SAME /api/portal prefix after portal.js /
// portalFoundation.js. Reuses the exact same portalAuthenticate middleware and
// email-ownership security model — a customer can only ever see their OWN data,
// derived from the Client rows that match their portal email. No new models
// (Support/Chat reuse SupportTicket + its `messages` JSON column), no duplicated
// business logic, no tenant-agnostic queries. Internal cost/fee fields are never
// selected. (docs/v2-master/11-Architecture-Freeze.md §7)

const router = require("express").Router();
const { prisma } = require("../middleware/auth");
const { portalAuthenticate } = require("../middleware/portalAuth");

router.use(portalAuthenticate);

function requireCustomer(req, res, next) {
  if (!req.portalUser.roles.includes("customer")) return res.status(403).json({ message: "Customer access required" });
  next();
}

// Resolve the caller's Client (by portal email). Returns {id, tenantId} or null.
async function ownClient(email) {
  return prisma.client.findFirst({ where: { email }, select: { id: true, tenantId: true, name: true } });
}

// ── Visa Status ── customer-safe view of their own visa applications.
// Cost fields (embassyFee/serviceFee) are NEVER selected.
router.get("/visa", requireCustomer, async (req, res) => {
  try {
    const rows = await prisma.visaApplication.findMany({
      where: { client: { email: req.portalUser.email } },
      select: {
        id: true, applicantName: true, passportNumber: true, nationality: true,
        visaType: true, destination: true, status: true, referenceNo: true,
        appliedDate: true, appointmentDate: true, decisionDate: true, expiryDate: true,
        bookingId: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Support Tickets ──
const TICKET_SAFE = {
  id: true, ticketNumber: true, subject: true, description: true, status: true,
  priority: true, category: true, bookingId: true, messages: true, createdAt: true, updatedAt: true,
};

router.get("/support-tickets", requireCustomer, async (req, res) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      where: { client: { email: req.portalUser.email } },
      select: TICKET_SAFE,
      orderBy: { updatedAt: "desc" },
    });
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/support-tickets", requireCustomer, async (req, res) => {
  try {
    const client = await ownClient(req.portalUser.email);
    if (!client) return res.status(404).json({ message: "Customer account not found" });
    const subject = String(req.body.subject || "").trim();
    if (!subject) return res.status(400).json({ message: "Subject is required" });

    // Booking, if provided, must belong to this customer (ownership check).
    let bookingId = null;
    if (req.body.bookingId) {
      const b = await prisma.booking.findFirst({ where: { id: req.body.bookingId, client: { email: req.portalUser.email } }, select: { id: true } });
      bookingId = b?.id || null;
    }

    // Tenant-scoped ticket number (unique per tenant, matches staff format).
    const count = await prisma.supportTicket.count({ where: { tenantId: client.tenantId } });
    const ticketNumber = `TKT-${String(count + 1).padStart(5, "0")}`;

    const first = String(req.body.message || req.body.description || "").trim();
    const messages = first ? [{ authorType: "customer", author: client.name || "Customer", body: first, at: new Date().toISOString() }] : [];

    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNumber,
        subject,
        description: first,
        status: "open",
        priority: ["low", "medium", "high", "urgent"].includes(req.body.priority) ? req.body.priority : "medium",
        category: String(req.body.category || "general"),
        source: "portal",
        clientId: client.id,
        bookingId,
        tenantId: client.tenantId,
        messages,
      },
      select: TICKET_SAFE,
    });
    res.status(201).json(ticket);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/support-tickets/:id", requireCustomer, async (req, res) => {
  try {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: req.params.id, client: { email: req.portalUser.email } },
      select: TICKET_SAFE,
    });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Live Chat / reply — append a customer message to the ticket thread.
router.post("/support-tickets/:id/messages", requireCustomer, async (req, res) => {
  try {
    const client = await ownClient(req.portalUser.email);
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: req.params.id, client: { email: req.portalUser.email } },
      select: { id: true, messages: true },
    });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    const body = String(req.body.body || req.body.message || "").trim();
    if (!body) return res.status(400).json({ message: "Message is required" });

    const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
    messages.push({ authorType: "customer", author: client?.name || "Customer", body, at: new Date().toISOString() });
    // A customer reply re-opens a resolved ticket.
    const updated = await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { messages, status: "open" },
      select: TICKET_SAFE,
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
