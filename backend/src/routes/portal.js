/**
 * Customer / Supplier Portal — magic-link auth + read-only data.
 *
 * Identity model: email-based. A portal user can have one of two roles
 * (or both):
 *   - "customer" — has bookings where Client.email matches
 *   - "supplier" — has vendor bills where Vendor.email matches
 *   - "agent" — sub-agent / B2B partner with Agent.email match
 *
 * Tokens use a separate JWT audience ("portal") so they CANNOT be used
 * against agency endpoints, and vice versa.
 */
const express = require("express");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const { sendEmail } = require("../services/emailService");
const {
  portalAuthenticate,
  PORTAL_AUDIENCE,
  SECRET,
} = require("../middleware/portalAuth");
const { portalAuthLimiter } = require("../middleware/rateLimit");
const {
  sanitizePortalBookingDetail,
  sanitizeAgentBooking,
  summarizeAgentCommissions,
} = require("../lib/portalBooking");

const prisma = new PrismaClient();
const router = express.Router();

const PORTAL_URL =
  process.env.PORTAL_URL ||
  (process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.replace(/^https?:\/\/(www\.)?/, "https://portal.")
    : "https://portal.travelagencyweb.com");

const MAGIC_AUDIENCE = "portal-magic";

async function classifyEmail(emailLower) {
  const [client, vendor, agent] = await Promise.all([
    prisma.client.findFirst({ where: { email: emailLower }, select: { id: true } }),
    prisma.vendor.findFirst({ where: { email: emailLower }, select: { id: true } }),
    prisma.agent.findFirst({
      where: {
        email: { equals: emailLower, mode: "insensitive" },
        NOT: { email: "" },
      },
      select: { id: true },
    }),
  ]);
  const roles = [];
  if (client) roles.push("customer");
  if (vendor) roles.push("supplier");
  if (agent) roles.push("agent");
  return roles;
}

// ── POST /portal/auth/request-link ──
router.post("/auth/request-link", portalAuthLimiter, async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ message: "Email required" });

    const roles = await classifyEmail(email);

    // Always respond 200 to avoid email enumeration.
    if (roles.length === 0) {
      return res.json({ ok: true });
    }

    const magicToken = jwt.sign(
      { email, roles },
      SECRET,
      { audience: MAGIC_AUDIENCE, expiresIn: "15m" }
    );
    const link = `${PORTAL_URL}/verify?token=${encodeURIComponent(magicToken)}`;

    await sendEmail({
      to: email,
      subject: "Your sign-in link",
      text: `Click to sign in: ${link}\n\nThis link expires in 15 minutes.`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;">
          <h2>Sign in to your portal</h2>
          <p>Click the button below to sign in. This link expires in 15 minutes.</p>
          <p style="margin:24px 0;">
            <a href="${link}" style="background:#3b82f6;color:#fff;padding:12px 24px;
               border-radius:6px;text-decoration:none;display:inline-block;">
              Sign in
            </a>
          </p>
          <p style="color:#666;font-size:12px;">If you didn't request this, ignore this email.</p>
        </div>`,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("[portal] request-link:", err);
    res.status(500).json({ message: "Failed to send link" });
  }
});

// ── POST /portal/auth/verify ──
// Exchange magic token for a 7-day portal session JWT.
router.post("/auth/verify", portalAuthLimiter, async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ message: "Token required" });
    const decoded = jwt.verify(token, SECRET, { audience: MAGIC_AUDIENCE });

    // Re-classify in case roles changed since the link was issued.
    const roles = await classifyEmail(decoded.email);
    if (roles.length === 0) {
      return res.status(403).json({ message: "No portal access for this email" });
    }

    const session = jwt.sign(
      { email: decoded.email, roles },
      SECRET,
      { audience: PORTAL_AUDIENCE, expiresIn: "7d" }
    );
    res.json({ token: session, email: decoded.email, roles });
  } catch {
    res.status(401).json({ message: "Invalid or expired link" });
  }
});

// ── GET /portal/auth/me ──
router.get("/auth/me", portalAuthenticate, (req, res) => {
  res.json({ token: "", email: req.portalUser.email, roles: req.portalUser.roles });
});

// ── GET /portal/bookings ──  (customer)
router.get("/bookings", portalAuthenticate, async (req, res) => {
  try {
    if (!req.portalUser.roles.includes("customer")) return res.json([]);
    const bookings = await prisma.booking.findMany({
      where: { client: { email: req.portalUser.email } },
      select: {
        id: true,
        title: true,
        destination: true,
        travelDateFrom: true,
        travelDateTo: true,
        status: true,
        paymentStatus: true,
        amount: true,
        paidAmount: true,
        dueAmount: true,
        tenant: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(
      bookings.map((b) => ({
        ...b,
        tenantName: b.tenant?.name,
        tenant: undefined,
      }))
    );
  } catch (err) {
    console.error("[portal] bookings:", err);
    res.status(500).json({ message: "Failed to load bookings" });
  }
});

// ── GET /portal/bookings/:id ──  (customer detail)
router.get("/bookings/:id", portalAuthenticate, async (req, res) => {
  try {
    if (!req.portalUser.roles.includes("customer")) {
      return res.status(403).json({ message: "Customer access required" });
    }
    const booking = await prisma.booking.findFirst({
      where: {
        id: req.params.id,
        client: { email: req.portalUser.email },
      },
      include: {
        tenant: { select: { name: true } },
        travelers: { select: { id: true, name: true, nationality: true } },
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            paidAmount: true,
            dueAmount: true,
            status: true,
            dueDate: true,
            issuedDate: true,
            installments: {
              select: {
                id: true,
                label: true,
                amount: true,
                paidAmount: true,
                dueDate: true,
                status: true,
              },
              orderBy: { sortOrder: "asc" },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        timeline: {
          select: {
            id: true,
            type: true,
            content: true,
            oldStatus: true,
            newStatus: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    res.json(sanitizePortalBookingDetail(booking));
  } catch (err) {
    console.error("[portal] booking detail:", err);
    res.status(500).json({ message: "Failed to load booking" });
  }
});

// ── GET /portal/agent/bookings ──  (B2B sub-agent)
router.get("/agent/bookings", portalAuthenticate, async (req, res) => {
  try {
    if (!req.portalUser.roles.includes("agent")) return res.json([]);
    const bookings = await prisma.booking.findMany({
      where: { agent: { email: { equals: req.portalUser.email, mode: "insensitive" } } },
      select: {
        id: true,
        title: true,
        destination: true,
        travelDateFrom: true,
        travelDateTo: true,
        status: true,
        amount: true,
        client: { select: { name: true } },
        tenant: { select: { name: true } },
        agentCommission: {
          select: { agentCommissionAmount: true, agentCommissionStatus: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(bookings.map(sanitizeAgentBooking));
  } catch (err) {
    console.error("[portal] agent bookings:", err);
    res.status(500).json({ message: "Failed to load agent bookings" });
  }
});

// ── GET /portal/agent/commissions ──  (B2B commission wallet summary)
router.get("/agent/commissions", portalAuthenticate, async (req, res) => {
  try {
    if (!req.portalUser.roles.includes("agent")) {
      return res.json({ pendingTotal: 0, paidTotal: 0, bookingCount: 0, items: [] });
    }
    const bookings = await prisma.booking.findMany({
      where: {
        agent: { email: { equals: req.portalUser.email, mode: "insensitive" } },
        agentCommission: { isNot: null },
      },
      select: {
        id: true,
        title: true,
        destination: true,
        travelDateFrom: true,
        status: true,
        amount: true,
        client: { select: { name: true } },
        tenant: { select: { name: true } },
        agentCommission: {
          select: { agentCommissionAmount: true, agentCommissionStatus: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    const summary = summarizeAgentCommissions(bookings);
    res.json({
      ...summary,
      items: bookings.map(sanitizeAgentBooking),
    });
  } catch (err) {
    console.error("[portal] agent commissions:", err);
    res.status(500).json({ message: "Failed to load commissions" });
  }
});

// ── GET /portal/purchase-orders ──  (supplier)
// Maps to VendorBills issued to this vendor email.
router.get("/purchase-orders", portalAuthenticate, async (req, res) => {
  try {
    if (!req.portalUser.roles.includes("supplier")) return res.json([]);
    const bills = await prisma.vendorBill.findMany({
      where: { vendor: { email: req.portalUser.email } },
      select: {
        id: true,
        description: true,
        totalAmount: true,
        paidAmount: true,
        dueAmount: true,
        status: true,
        dueDate: true,
        createdAt: true,
        tenant: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(
      bills.map((b) => ({
        ...b,
        tenantName: b.tenant?.name,
        tenant: undefined,
      }))
    );
  } catch (err) {
    console.error("[portal] purchase-orders:", err);
    res.status(500).json({ message: "Failed to load purchase orders" });
  }
});

module.exports = router;
