// Customer & Agent Portal Foundation — richer, still read-mostly portal
// endpoints built ON TOP of the existing /api/portal security model.
// (docs/v2-master/11-Architecture-Freeze.md §7, docs/v2-master/12-Implementation-Sequence.md Phase 7).
//
// SECURITY (the whole point of this milestone): reuses the existing
// portalAuthenticate middleware (JWT audience "portal") and the exact same
// ownership pattern as routes/portal.js — EVERY query filters by the
// email-owned relation (client.email for customers, agent.email for agents),
// plus a role gate. No query is tenant-agnostic-but-unfiltered; a customer
// can only ever reach their own bookings/invoices/payments/documents, and an
// agent only their own customers/bookings/commissions. This router is mounted
// at the same /api/portal prefix (additively, after portal.js), so the two
// share one auth + one security model — nothing is re-implemented.
//
// Reuse: portalAuthenticate (auth), portalBooking.js sanitizers (customer-safe
// shapes), the Shared Document Engine's Document model + bookings.js multer
// upload (documents — no duplicate upload logic), Agent Engine's pure ledger
// summarizers, and portalFoundation.js pure aggregators. The existing
// /api/portal endpoints (auth, bookings, agent/bookings, agent/commissions,
// purchase-orders) are UNTOUCHED.

const router = require("express").Router();
const { prisma } = require("../middleware/auth");
const { portalAuthenticate } = require("../middleware/portalAuth");
const { upload } = require("./bookings");
const { sanitizeInvoice } = require("../lib/portalBooking");
const { summarizeLedger, summarizeBookingAttribution } = require("../lib/agentEngine");
const {
  buildCustomerDashboard,
  buildCustomerNotifications,
  buildAgentDashboard,
  distinctCustomersFromBookings,
  buildAgentNotifications,
} = require("../lib/portalFoundation");

router.use(portalAuthenticate);

function nowIso() {
  return new Date().toISOString();
}

function requireCustomer(req, res, next) {
  if (!req.portalUser.roles.includes("customer")) return res.status(403).json({ message: "Customer access required" });
  next();
}
function requireAgent(req, res, next) {
  if (!req.portalUser.roles.includes("agent")) return res.status(403).json({ message: "Agent access required" });
  next();
}

// Booking.type -> Shared Document Engine entityType (so portal-uploaded docs
// appear in the corresponding booking module's document view).
const BOOKING_TYPE_TO_DOC_ENTITY = { ticket: "air_ticket", visa: "visa", hotel: "hotel", hajj: "hajj", tour: "tour" };
function docEntityType(bookingType) {
  return BOOKING_TYPE_TO_DOC_ENTITY[bookingType] || bookingType || "other";
}

// Ownership guards — return the booking ONLY if it belongs to this portal user
// (by email), else null. Never reveal existence of a non-owned booking.
async function ownedCustomerBooking(bookingId, email) {
  return prisma.booking.findFirst({ where: { id: bookingId, client: { email } }, select: { id: true, type: true, tenantId: true } });
}
async function ownedAgentBooking(bookingId, email) {
  return prisma.booking.findFirst({
    where: { id: bookingId, agent: { email: { equals: email, mode: "insensitive" } } },
    select: { id: true, type: true, tenantId: true },
  });
}

// ══════════════════════ CUSTOMER PORTAL ══════════════════════

// Dashboard
router.get("/dashboard", requireCustomer, async (req, res) => {
  try {
    const email = req.portalUser.email;
    const bookings = await prisma.booking.findMany({
      where: { client: { email } },
      select: { id: true, title: true, destination: true, status: true, paymentStatus: true, amount: true, paidAmount: true, dueAmount: true, travelDateFrom: true },
      orderBy: { createdAt: "desc" },
    });
    const invoices = await prisma.invoice.findMany({
      where: { booking: { client: { email } } },
      select: { id: true, invoiceNumber: true, dueAmount: true, dueDate: true },
    });
    const asOf = nowIso();
    res.json({
      ...buildCustomerDashboard(bookings, asOf),
      notificationCount: buildCustomerNotifications(bookings, invoices, asOf).length,
      recentBookings: bookings.slice(0, 5),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Invoice View
router.get("/invoices", requireCustomer, async (req, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { booking: { client: { email: req.portalUser.email } } },
      select: {
        id: true, invoiceNumber: true, totalAmount: true, paidAmount: true, dueAmount: true, status: true, dueDate: true, issuedDate: true,
        installments: { select: { id: true, label: true, amount: true, paidAmount: true, dueDate: true, status: true }, orderBy: { sortOrder: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(invoices.map(sanitizeInvoice));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Payment History
router.get("/payments", requireCustomer, async (req, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { booking: { client: { email: req.portalUser.email } } },
      select: { id: true, invoiceNumber: true },
    });
    const invoiceIds = invoices.map((i) => i.id);
    const invoiceNumberById = new Map(invoices.map((i) => [i.id, i.invoiceNumber]));
    const payments = invoiceIds.length
      ? await prisma.payment.findMany({
        where: { invoiceId: { in: invoiceIds } },
        select: { id: true, amount: true, method: true, date: true, invoiceId: true },
        orderBy: { date: "desc" },
      })
      : [];
    // Sanitized: no receivedBy / transactionRef leakage to the customer.
    res.json(payments.map((p) => ({ id: p.id, amount: p.amount, method: p.method, date: p.date, invoiceNumber: invoiceNumberById.get(p.invoiceId) || null })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Notifications (derived feed)
router.get("/notifications", requireCustomer, async (req, res) => {
  try {
    const email = req.portalUser.email;
    const [bookings, invoices] = await Promise.all([
      prisma.booking.findMany({ where: { client: { email } }, select: { id: true, title: true, destination: true, travelDateFrom: true } }),
      prisma.invoice.findMany({ where: { booking: { client: { email } } }, select: { id: true, invoiceNumber: true, dueAmount: true, dueDate: true } }),
    ]);
    res.json(buildCustomerNotifications(bookings, invoices, nowIso()));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Profile — view + update OWN contact info (whitelisted, ownership by email)
router.get("/profile", requireCustomer, async (req, res) => {
  try {
    const client = await prisma.client.findFirst({
      where: { email: req.portalUser.email },
      select: { id: true, name: true, phone: true, email: true, alternatePhone: true, address: true, dateOfBirth: true, nationality: true, emergencyContact: true, emergencyPhone: true },
    });
    if (!client) return res.status(404).json({ message: "Profile not found" });
    res.json(client);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.patch("/profile", requireCustomer, async (req, res) => {
  try {
    const editable = ["phone", "alternatePhone", "address", "dateOfBirth", "emergencyContact", "emergencyPhone"];
    const data = {};
    for (const key of editable) if (req.body[key] !== undefined) data[key] = req.body[key];
    if (Object.keys(data).length === 0) return res.status(400).json({ message: "No editable fields provided" });

    // Ownership is enforced by the email filter — a customer can only ever
    // update the Client record that matches their own portal email.
    const result = await prisma.client.updateMany({ where: { email: req.portalUser.email }, data });
    if (!result.count) return res.status(404).json({ message: "Profile not found" });
    const client = await prisma.client.findFirst({
      where: { email: req.portalUser.email },
      select: { id: true, name: true, phone: true, email: true, alternatePhone: true, address: true, dateOfBirth: true, nationality: true, emergencyContact: true, emergencyPhone: true },
    });
    res.json(client);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Documents — download (list) + upload, scoped to a booking the customer owns
router.get("/bookings/:bookingId/documents", requireCustomer, async (req, res) => {
  try {
    const booking = await ownedCustomerBooking(req.params.bookingId, req.portalUser.email);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    res.json(await prisma.document.findMany({
      where: { tenantId: booking.tenantId, entityType: docEntityType(booking.type), entityId: booking.id },
      orderBy: { createdAt: "desc" },
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/bookings/:bookingId/documents", requireCustomer, upload.single("file"), async (req, res) => {
  try {
    const booking = await ownedCustomerBooking(req.params.bookingId, req.portalUser.email);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const version = { versionNumber: 1, fileName: req.file.originalname, url: `/uploads/${req.file.filename}`, mimeType: req.file.mimetype, size: req.file.size, uploadedBy: `portal:${req.portalUser.email}`, uploadedAt: nowIso() };
    const doc = await prisma.document.create({
      data: {
        tenantId: booking.tenantId,
        entityType: docEntityType(booking.type),
        entityId: booking.id,
        category: req.body.category || "other",
        title: String(req.body.title || req.file.originalname).trim(),
        versions: [version],
        history: [{ action: "created", actorId: `portal:${req.portalUser.email}`, detail: "uploaded via customer portal", at: nowIso() }],
        createdBy: `portal:${req.portalUser.email}`,
      },
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ══════════════════════ AGENT PORTAL ══════════════════════

const AGENT_BOOKING_WHERE = (email) => ({ agent: { email: { equals: email, mode: "insensitive" } } });

// Dashboard
router.get("/agent/dashboard", requireAgent, async (req, res) => {
  try {
    const email = req.portalUser.email;
    const bookings = await prisma.booking.findMany({
      where: AGENT_BOOKING_WHERE(email),
      select: { id: true, status: true, client: { select: { id: true, name: true, phone: true, email: true } }, agentCommission: { select: { agentCommissionAmount: true, agentCommissionStatus: true } } },
      orderBy: { createdAt: "desc" },
    });
    const customers = distinctCustomersFromBookings(bookings);
    const summary = summarizeBookingAttribution(bookings);
    res.json(buildAgentDashboard(bookings, customers.length, { pendingTotal: summary.pending.amount, paidTotal: summary.paid.amount }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// My Customers — only the customers on this agent's own bookings
router.get("/agent/customers", requireAgent, async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: AGENT_BOOKING_WHERE(req.portalUser.email),
      select: { client: { select: { id: true, name: true, phone: true, email: true } } },
    });
    res.json(distinctCustomersFromBookings(bookings));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get("/agent/customers/:id", requireAgent, async (req, res) => {
  try {
    // A customer is only visible if the agent has at least one booking with them.
    const booking = await prisma.booking.findFirst({
      where: { clientId: req.params.id, ...AGENT_BOOKING_WHERE(req.portalUser.email) },
      select: { client: { select: { id: true, name: true, phone: true, email: true, address: true, nationality: true } } },
    });
    if (!booking?.client) return res.status(404).json({ message: "Customer not found" });
    res.json(booking.client);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Commission Ledger (composes Agent Engine's pure summarizers)
router.get("/agent/ledger", requireAgent, async (req, res) => {
  try {
    const email = req.portalUser.email;
    const agents = await prisma.agent.findMany({ where: { email: { equals: email, mode: "insensitive" }, NOT: { email: "" } }, select: { id: true } });
    const agentIds = agents.map((a) => a.id);
    const transactions = agentIds.length
      ? await prisma.agentTransaction.findMany({ where: { agentId: { in: agentIds } }, orderBy: { createdAt: "desc" }, select: { id: true, type: true, amount: true, balance: true, method: true, note: true, createdAt: true } })
      : [];
    const bookings = await prisma.booking.findMany({
      where: { ...AGENT_BOOKING_WHERE(email), agentCommission: { isNot: null } },
      select: { id: true, agentCommission: { select: { agentCommissionAmount: true, agentCommissionStatus: true } } },
    });
    res.json({
      ledger: { transactions, summary: summarizeLedger(transactions) },
      bookingAttribution: summarizeBookingAttribution(bookings),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Payment History (money the agency paid this agent — AgentTransaction type "payment")
router.get("/agent/payments", requireAgent, async (req, res) => {
  try {
    const agents = await prisma.agent.findMany({ where: { email: { equals: req.portalUser.email, mode: "insensitive" }, NOT: { email: "" } }, select: { id: true } });
    const agentIds = agents.map((a) => a.id);
    const payments = agentIds.length
      ? await prisma.agentTransaction.findMany({ where: { agentId: { in: agentIds }, type: "payment" }, orderBy: { createdAt: "desc" }, select: { id: true, amount: true, method: true, note: true, createdAt: true } })
      : [];
    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Notifications (derived feed)
router.get("/agent/notifications", requireAgent, async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { ...AGENT_BOOKING_WHERE(req.portalUser.email), agentCommission: { isNot: null } },
      select: { id: true, title: true, destination: true, agentCommission: { select: { agentCommissionAmount: true, agentCommissionStatus: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(buildAgentNotifications(bookings));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Documents — upload + list, scoped to a booking the agent owns
router.get("/agent/bookings/:bookingId/documents", requireAgent, async (req, res) => {
  try {
    const booking = await ownedAgentBooking(req.params.bookingId, req.portalUser.email);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    res.json(await prisma.document.findMany({
      where: { tenantId: booking.tenantId, entityType: docEntityType(booking.type), entityId: booking.id },
      orderBy: { createdAt: "desc" },
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/agent/bookings/:bookingId/documents", requireAgent, upload.single("file"), async (req, res) => {
  try {
    const booking = await ownedAgentBooking(req.params.bookingId, req.portalUser.email);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const version = { versionNumber: 1, fileName: req.file.originalname, url: `/uploads/${req.file.filename}`, mimeType: req.file.mimetype, size: req.file.size, uploadedBy: `portal-agent:${req.portalUser.email}`, uploadedAt: nowIso() };
    const doc = await prisma.document.create({
      data: {
        tenantId: booking.tenantId,
        entityType: docEntityType(booking.type),
        entityId: booking.id,
        category: req.body.category || "other",
        title: String(req.body.title || req.file.originalname).trim(),
        versions: [version],
        history: [{ action: "created", actorId: `portal-agent:${req.portalUser.email}`, detail: "uploaded via agent portal", at: nowIso() }],
        createdBy: `portal-agent:${req.portalUser.email}`,
      },
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
