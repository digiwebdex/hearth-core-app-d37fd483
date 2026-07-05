// Agent Engine — Phase 2, CRM Architecture Enhancement (approved after CRM review)
// (docs/v2-master/11-Architecture-Freeze.md, docs/v2-master/12-Implementation-Sequence.md Phase 2).
//
// Read-only. Wraps the existing Agent, AgentCommissionProfile, and
// AgentTransaction models exactly as they exist today — no new fields, no
// write path. Does not replace /api/agents (backend/src/routes/agents.js),
// which keeps working unchanged.
//
// Schema note (verified directly against backend/prisma/schema.prisma, not
// assumed): Agent itself has no `status` or `commissionRate` column — both
// live on the related AgentCommissionProfile (`agentId @id`, `commissionRate`,
// `status`). The frontend's flattened Agent type (src/lib/api.ts) exposes
// them as top-level fields because the existing /api/agents route joins
// them in its response shape; this engine reads them from their real
// location instead of assuming they're on Agent directly.
//
// "Booking Attribution" requires reading Booking (via its `agentId` column
// and its `agentCommission` relation to BookingAgentCommission) — neither
// model was in the explicitly approved wrap list, but resolving booking
// attribution is impossible without them, so they are read (never written)
// as the minimal extension needed to satisfy that requirement.
//
// Real read failures are not masked — same fail-loud contract as every
// other CRM Foundation engine (customerEngine.js, leadEngine.js, ...).

const { prisma } = require("../middleware/auth");

/** Pure: totals a ledger's transactions by type. No database access. */
function summarizeLedger(transactions) {
  const summary = { transactionCount: transactions.length, deposits: 0, payments: 0, adjustments: 0 };
  for (const t of transactions) {
    if (t.type === "deposit") summary.deposits += t.amount;
    else if (t.type === "payment") summary.payments += t.amount;
    else if (t.type === "adjustment") summary.adjustments += t.amount;
  }
  return summary;
}

/** Pure: summarizes booking-level commission attribution. No database access. */
function summarizeBookingAttribution(bookings) {
  let pendingCount = 0;
  let pendingAmount = 0;
  let paidCount = 0;
  let paidAmount = 0;
  for (const booking of bookings) {
    const commission = booking.agentCommission;
    if (!commission) continue;
    if (commission.agentCommissionStatus === "paid") {
      paidCount += 1;
      paidAmount += commission.agentCommissionAmount || 0;
    } else {
      pendingCount += 1;
      pendingAmount += commission.agentCommissionAmount || 0;
    }
  }
  return {
    totalBookings: bookings.length,
    commissionedBookings: pendingCount + paidCount,
    pending: { count: pendingCount, amount: pendingAmount },
    paid: { count: paidCount, amount: paidAmount },
  };
}

/** Resolve one agent's composed context: profile + commission + running balance + ledger + booking attribution. Returns null if not found in this tenant. */
async function resolveAgentContext(agentId, tenantId) {
  if (!agentId || !tenantId) return null;

  const agent = await prisma.agent.findFirst({
    where: { id: agentId, tenantId },
    select: { id: true, name: true, phone: true, email: true, address: true, balance: true, createdAt: true },
  });
  if (!agent) return null;

  const [commissionProfile, transactions, bookings] = await Promise.all([
    prisma.agentCommissionProfile.findUnique({
      where: { agentId },
      select: { commissionRate: true, status: true, userId: true },
    }),
    prisma.agentTransaction.findMany({
      where: { agentId, tenantId },
      orderBy: { createdAt: "desc" },
      select: { id: true, type: true, amount: true, balance: true, method: true, note: true, createdAt: true },
    }),
    prisma.booking.findMany({
      where: { agentId, tenantId },
      select: {
        id: true, status: true, paymentStatus: true, amount: true,
        agentCommission: { select: { agentCommissionAmount: true, agentCommissionStatus: true } },
      },
    }),
  ]);

  return {
    ...agent,
    commission: commissionProfile
      ? { commissionRate: commissionProfile.commissionRate, status: commissionProfile.status, linkedUserId: commissionProfile.userId }
      : null,
    runningBalance: agent.balance,
    ledger: { transactions, summary: summarizeLedger(transactions) },
    bookingAttribution: summarizeBookingAttribution(bookings),
  };
}

module.exports = { resolveAgentContext, summarizeLedger, summarizeBookingAttribution };
