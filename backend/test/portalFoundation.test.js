require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-at-least-32-characters-long";
process.env.RATE_LIMIT_DISABLED = "true";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { createApp } = require("../src/app");
const { PORTAL_AUDIENCE, SECRET } = require("../src/middleware/portalAuth");
const { sanitizeInvoice } = require("../src/lib/portalBooking");
const {
  buildCustomerDashboard,
  buildCustomerNotifications,
  buildAgentDashboard,
  distinctCustomersFromBookings,
  buildAgentNotifications,
} = require("../src/lib/portalFoundation");

function portalToken(roles) {
  return jwt.sign({ email: "user@example.com", roles }, SECRET, { audience: PORTAL_AUDIENCE, expiresIn: "1h" });
}

describe("portalFoundation — buildCustomerDashboard (pure)", () => {
  it("aggregates the customer's own bookings into KPIs", () => {
    const bookings = [
      { status: "confirmed", dueAmount: 100, paidAmount: 400, travelDateFrom: "2026-08-01" },
      { status: "confirmed", dueAmount: 0, paidAmount: 500, travelDateFrom: "2020-01-01" },
      { status: "inquiry", dueAmount: 250, paidAmount: 0, travelDateFrom: null },
    ];
    const dash = buildCustomerDashboard(bookings, "2026-06-15T00:00:00Z");
    assert.equal(dash.bookingCount, 3);
    assert.equal(dash.upcomingCount, 1); // only the 2026-08-01 trip is upcoming
    assert.equal(dash.totalDue, 350);
    assert.equal(dash.totalPaid, 900);
    assert.deepEqual(dash.byStatus, { confirmed: 2, inquiry: 1 });
  });
});

describe("portalFoundation — buildCustomerNotifications (pure)", () => {
  it("derives overdue-invoice and upcoming-trip items, sorted by date", () => {
    const asOf = "2026-06-15T00:00:00Z";
    const bookings = [{ id: "b1", title: "Bali Trip", travelDateFrom: "2026-06-18" }];
    const invoices = [{ id: "i1", invoiceNumber: "INV-1", dueAmount: 100, dueDate: "2026-06-01" }];
    const items = buildCustomerNotifications(bookings, invoices, asOf);
    assert.equal(items.length, 2);
    assert.equal(items[0].type, "invoice_overdue"); // 2026-06-01 sorts first
    assert.equal(items[1].type, "trip_upcoming");
  });

  it("ignores paid invoices and far-future trips", () => {
    const asOf = "2026-06-15T00:00:00Z";
    const items = buildCustomerNotifications(
      [{ id: "b1", travelDateFrom: "2027-01-01" }],
      [{ id: "i1", dueAmount: 0, dueDate: "2026-01-01" }],
      asOf,
    );
    assert.equal(items.length, 0);
  });
});

describe("portalFoundation — agent aggregators (pure)", () => {
  it("distinctCustomersFromBookings dedupes clients by id", () => {
    const bookings = [
      { client: { id: "c1", name: "A", phone: "1", email: "a@x.com" } },
      { client: { id: "c1", name: "A", phone: "1", email: "a@x.com" } },
      { client: { id: "c2", name: "B" } },
      { client: null },
    ];
    const customers = distinctCustomersFromBookings(bookings);
    assert.equal(customers.length, 2);
    assert.deepEqual(customers.map((c) => c.id).sort(), ["c1", "c2"]);
  });

  it("buildAgentDashboard reports booking/customer counts + commission totals", () => {
    const bookings = [{ status: "confirmed" }, { status: "inquiry" }];
    const dash = buildAgentDashboard(bookings, 5, { pendingTotal: 300, paidTotal: 700 });
    assert.equal(dash.bookingCount, 2);
    assert.equal(dash.customerCount, 5);
    assert.deepEqual(dash.commission, { pendingTotal: 300, paidTotal: 700 });
    assert.deepEqual(dash.byStatus, { confirmed: 1, inquiry: 1 });
  });

  it("buildAgentNotifications flags paid vs pending commissions", () => {
    const items = buildAgentNotifications([
      { id: "b1", title: "T1", agentCommission: { agentCommissionAmount: 500, agentCommissionStatus: "paid" } },
      { id: "b2", title: "T2", agentCommission: { agentCommissionAmount: 200, agentCommissionStatus: "pending" } },
      { id: "b3", title: "T3", agentCommission: null },
    ]);
    assert.equal(items.length, 2);
    assert.equal(items.find((i) => i.ref === "b1").type, "commission_paid");
    assert.equal(items.find((i) => i.ref === "b2").type, "commission_pending");
  });
});

describe("portalBooking — sanitizeInvoice is now exported and customer-safe", () => {
  it("returns only customer-safe invoice fields", () => {
    const out = sanitizeInvoice({ id: "i1", invoiceNumber: "INV-1", totalAmount: 1000, paidAmount: 400, dueAmount: 600, status: "partial", dueDate: "2026-07-01", issuedDate: "2026-06-01", installments: [], tenantId: "SECRET", notes: "internal" });
    assert.deepEqual(Object.keys(out).sort(), ["dueAmount", "dueDate", "id", "installments", "invoiceNumber", "issuedDate", "paidAmount", "status", "totalAmount"].sort());
    assert.equal(out.tenantId, undefined);
    assert.equal(out.notes, undefined);
  });
});

describe("/api/portal (foundation) — authentication is required on every endpoint", () => {
  const app = createApp();
  const endpoints = [
    ["get", "/api/portal/dashboard"],
    ["get", "/api/portal/invoices"],
    ["get", "/api/portal/payments"],
    ["get", "/api/portal/notifications"],
    ["get", "/api/portal/profile"],
    ["patch", "/api/portal/profile"],
    ["get", "/api/portal/bookings/some-id/documents"],
    ["post", "/api/portal/bookings/some-id/documents"],
    ["get", "/api/portal/agent/dashboard"],
    ["get", "/api/portal/agent/customers"],
    ["get", "/api/portal/agent/customers/some-id"],
    ["get", "/api/portal/agent/ledger"],
    ["get", "/api/portal/agent/payments"],
    ["get", "/api/portal/agent/notifications"],
    ["get", "/api/portal/agent/bookings/some-id/documents"],
    ["post", "/api/portal/agent/bookings/some-id/documents"],
  ];

  for (const [method, path] of endpoints) {
    it(`401 without a token: ${method.toUpperCase()} ${path}`, async () => {
      const res = await request(app)[method](path);
      assert.equal(res.status, 401);
    });
  }
});

describe("/api/portal (foundation) — role-based security (no cross-role access)", () => {
  const app = createApp();
  const agentToken = portalToken(["agent"]);
  const customerToken = portalToken(["customer"]);

  const customerEndpoints = [
    ["get", "/api/portal/dashboard"],
    ["get", "/api/portal/invoices"],
    ["get", "/api/portal/payments"],
    ["get", "/api/portal/notifications"],
    ["get", "/api/portal/profile"],
    ["patch", "/api/portal/profile"],
    ["get", "/api/portal/bookings/some-id/documents"],
  ];
  const agentEndpoints = [
    ["get", "/api/portal/agent/dashboard"],
    ["get", "/api/portal/agent/customers"],
    ["get", "/api/portal/agent/customers/some-id"],
    ["get", "/api/portal/agent/ledger"],
    ["get", "/api/portal/agent/payments"],
    ["get", "/api/portal/agent/notifications"],
    ["get", "/api/portal/agent/bookings/some-id/documents"],
  ];

  for (const [method, path] of customerEndpoints) {
    it(`an agent-only token is forbidden (403) from customer endpoint ${method.toUpperCase()} ${path}`, async () => {
      const res = await request(app)[method](path).set("Authorization", `Bearer ${agentToken}`);
      assert.equal(res.status, 403);
      assert.match(res.body.message, /customer access required/i);
    });
  }

  for (const [method, path] of agentEndpoints) {
    it(`a customer-only token is forbidden (403) from agent endpoint ${method.toUpperCase()} ${path}`, async () => {
      const res = await request(app)[method](path).set("Authorization", `Bearer ${customerToken}`);
      assert.equal(res.status, 403);
      assert.match(res.body.message, /agent access required/i);
    });
  }

  it("an agency (default-audience) token is NOT accepted by the portal (wrong JWT audience)", async () => {
    const agencyToken = jwt.sign({ userId: "u1", tenantId: "t1", role: "tenant_owner" }, SECRET, { expiresIn: "1h" });
    const res = await request(app).get("/api/portal/dashboard").set("Authorization", `Bearer ${agencyToken}`);
    assert.equal(res.status, 401); // no "portal" audience -> rejected
  });
});
