// Portal Foundation — pure aggregation/derivation helpers for the Customer &
// Agent portals.
// (docs/v2-master/11-Architecture-Freeze.md §7, docs/v2-master/12-Implementation-Sequence.md Phase 7).
//
// Pure — no database access, no side effects. The route
// (routes/portalFoundation.js) fetches the already-ownership-filtered rows
// (by client.email / agent.email, reusing the existing portal security model)
// and passes them in. These helpers NEVER see or filter by identity — they
// just aggregate what they're given, so they cannot introduce a data-leak
// path; ownership is enforced entirely at the query layer in the route.

const { round2 } = require("./numeric");
function isoDay(value) {
  return String(value || "").slice(0, 10);
}

/** Customer dashboard KPIs from the customer's own bookings. Pure. */
function buildCustomerDashboard(bookings = [], asOfIso) {
  const today = isoDay(asOfIso);
  const byStatus = {};
  let totalDue = 0;
  let totalPaid = 0;
  let upcomingCount = 0;
  for (const b of bookings) {
    byStatus[b.status] = (byStatus[b.status] || 0) + 1;
    totalDue += Number(b.dueAmount) || 0;
    totalPaid += Number(b.paidAmount) || 0;
    if (b.travelDateFrom && isoDay(b.travelDateFrom) >= today) upcomingCount += 1;
  }
  return {
    bookingCount: bookings.length,
    upcomingCount,
    totalDue: round2(totalDue),
    totalPaid: round2(totalPaid),
    byStatus,
  };
}

/** Derived customer notification feed (no dedicated model): overdue invoices + upcoming trips. Pure. */
function buildCustomerNotifications(bookings = [], invoices = [], asOfIso) {
  const today = isoDay(asOfIso);
  const horizon = isoDay(new Date(new Date(asOfIso).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString());
  const items = [];

  for (const inv of invoices) {
    if (Number(inv.dueAmount) > 0 && inv.dueDate && isoDay(inv.dueDate) < today) {
      items.push({ type: "invoice_overdue", title: `Invoice ${inv.invoiceNumber || inv.id} is overdue`, date: isoDay(inv.dueDate), ref: inv.id });
    }
  }
  for (const b of bookings) {
    const dep = b.travelDateFrom ? isoDay(b.travelDateFrom) : null;
    if (dep && dep >= today && dep <= horizon) {
      items.push({ type: "trip_upcoming", title: `Upcoming trip: ${b.title || b.destination || b.id}`, date: dep, ref: b.id });
    }
  }
  return items.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/** Agent dashboard KPIs. Pure. */
function buildAgentDashboard(bookings = [], customerCount = 0, commissionSummary = {}) {
  const byStatus = {};
  for (const b of bookings) byStatus[b.status] = (byStatus[b.status] || 0) + 1;
  return {
    bookingCount: bookings.length,
    customerCount,
    byStatus,
    commission: {
      pendingTotal: commissionSummary.pendingTotal ?? 0,
      paidTotal: commissionSummary.paidTotal ?? 0,
    },
  };
}

/** Dedupe the clients across an agent's bookings into a distinct customer list. Pure. */
function distinctCustomersFromBookings(bookings = []) {
  const map = new Map();
  for (const b of bookings) {
    const c = b.client;
    if (c && c.id && !map.has(c.id)) {
      map.set(c.id, { id: c.id, name: c.name, phone: c.phone ?? null, email: c.email ?? null });
    }
  }
  return [...map.values()];
}

/** Agent notification feed (derived): commission newly paid + recent bookings. Pure. */
function buildAgentNotifications(bookings = []) {
  const items = [];
  for (const b of bookings) {
    const c = b.agentCommission;
    if (c && c.agentCommissionStatus === "paid") {
      items.push({ type: "commission_paid", title: `Commission paid for ${b.title || b.destination || b.id}`, ref: b.id, amount: c.agentCommissionAmount ?? null });
    } else if (c && Number(c.agentCommissionAmount) > 0) {
      items.push({ type: "commission_pending", title: `Commission pending for ${b.title || b.destination || b.id}`, ref: b.id, amount: c.agentCommissionAmount ?? null });
    }
  }
  return items;
}

module.exports = {
  buildCustomerDashboard,
  buildCustomerNotifications,
  buildAgentDashboard,
  distinctCustomersFromBookings,
  buildAgentNotifications,
};
