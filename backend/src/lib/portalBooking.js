/**
 * Sanitize booking records for customer-facing portal responses.
 * Strips internal cost/profit and limits timeline to customer-safe events.
 */

const CUSTOMER_TIMELINE_TYPES = new Set(["status_change", "system"]);

function sanitizeInstallment(row) {
  return {
    id: row.id,
    label: row.label,
    amount: row.amount,
    paidAmount: row.paidAmount,
    dueDate: row.dueDate,
    status: row.status,
  };
}

function sanitizeInvoice(row) {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    totalAmount: row.totalAmount,
    paidAmount: row.paidAmount,
    dueAmount: row.dueAmount,
    status: row.status,
    dueDate: row.dueDate,
    issuedDate: row.issuedDate,
    installments: (row.installments || []).map(sanitizeInstallment),
  };
}

function sanitizeTraveler(row) {
  return {
    id: row.id,
    name: row.name,
    nationality: row.nationality || null,
  };
}

function sanitizeTimelineEvent(row) {
  return {
    id: row.id,
    type: row.type,
    content: row.content,
    oldStatus: row.oldStatus,
    newStatus: row.newStatus,
    createdAt: row.createdAt,
  };
}

function sanitizePortalBookingDetail(booking) {
  if (!booking) return null;

  const timeline = (booking.timeline || []).filter((e) =>
    CUSTOMER_TIMELINE_TYPES.has(e.type)
  );

  return {
    id: booking.id,
    type: booking.type,
    title: booking.title,
    destination: booking.destination,
    travelDateFrom: booking.travelDateFrom,
    travelDateTo: booking.travelDateTo,
    travelerCount: booking.travelerCount,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    amount: booking.amount,
    paidAmount: booking.paidAmount,
    dueAmount: booking.dueAmount,
    serviceType: booking.serviceType,
    tenantName: booking.tenant?.name,
    travelers: (booking.travelers || []).map(sanitizeTraveler),
    invoices: (booking.invoices || []).map(sanitizeInvoice),
    timeline: timeline.map(sanitizeTimelineEvent),
  };
}

function sanitizeAgentBooking(row) {
  return {
    id: row.id,
    title: row.title,
    destination: row.destination,
    travelDateFrom: row.travelDateFrom,
    travelDateTo: row.travelDateTo,
    status: row.status,
    amount: row.amount,
    clientName: row.client?.name || "",
    tenantName: row.tenant?.name,
    commissionAmount: row.agentCommission?.agentCommissionAmount ?? null,
    commissionStatus: row.agentCommission?.agentCommissionStatus ?? null,
  };
}

function summarizeAgentCommissions(bookings) {
  let pendingTotal = 0;
  let paidTotal = 0;
  for (const b of bookings) {
    const amount = Number(b.agentCommission?.agentCommissionAmount) || 0;
    const status = b.agentCommission?.agentCommissionStatus;
    if (status === "paid") paidTotal += amount;
    else if (amount > 0) pendingTotal += amount;
  }
  return {
    pendingTotal: Math.round(pendingTotal * 100) / 100,
    paidTotal: Math.round(paidTotal * 100) / 100,
    bookingCount: bookings.length,
  };
}

module.exports = {
  CUSTOMER_TIMELINE_TYPES,
  sanitizePortalBookingDetail,
  sanitizeAgentBooking,
  summarizeAgentCommissions,
};
