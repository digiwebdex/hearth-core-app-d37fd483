const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  sanitizePortalBookingDetail,
  summarizeAgentCommissions,
} = require("../src/lib/portalBooking");

describe("portalBooking", () => {
  it("strips internal fields from booking detail", () => {
    const raw = {
      id: "b1",
      type: "tour",
      title: "Dhaka Tour",
      cost: 5000,
      profit: 2000,
      amount: 7000,
      paidAmount: 3000,
      dueAmount: 4000,
      status: "confirmed",
      paymentStatus: "partial",
      tenant: { name: "Test Agency" },
      client: { name: "Client A", email: "c@example.com" },
      travelers: [{ id: "t1", name: "Ali", passportNumber: "X123" }],
      invoices: [
        {
          id: "inv1",
          invoiceNumber: "INV-001",
          totalAmount: 7000,
          paidAmount: 3000,
          dueAmount: 4000,
          status: "partial",
          dueDate: "2026-07-01",
          installments: [
            { id: "i1", label: "1st", amount: 3500, paidAmount: 3000, dueDate: "2026-06-01", status: "partial" },
          ],
        },
      ],
      timeline: [
        { id: "e1", type: "status_change", content: "Confirmed", createdAt: "2026-06-01" },
        { id: "e2", type: "note", content: "Internal note", createdAt: "2026-06-02" },
      ],
    };

    const out = sanitizePortalBookingDetail(raw);
    assert.equal(out.id, "b1");
    assert.equal(out.tenantName, "Test Agency");
    assert.equal(out.travelers[0].name, "Ali");
    assert.equal(out.travelers[0].passportNumber, undefined);
    assert.equal(out.invoices[0].installments.length, 1);
    assert.equal(out.timeline.length, 1);
    assert.equal(out.timeline[0].type, "status_change");
    assert.equal(out.cost, undefined);
    assert.equal(out.profit, undefined);
  });

  it("summarizes agent commission totals", () => {
    const bookings = [
      { agentCommission: { agentCommissionAmount: 500, agentCommissionStatus: "pending" } },
      { agentCommission: { agentCommissionAmount: 300, agentCommissionStatus: "paid" } },
      { agentCommission: { agentCommissionAmount: 200, agentCommissionStatus: "approved" } },
    ];
    const summary = summarizeAgentCommissions(bookings);
    assert.equal(summary.pendingTotal, 700);
    assert.equal(summary.paidTotal, 300);
    assert.equal(summary.bookingCount, 3);
  });
});
