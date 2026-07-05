require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-at-least-32-characters-long";
process.env.RATE_LIMIT_DISABLED = "true";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveAgentContext,
  summarizeLedger,
  summarizeBookingAttribution,
} = require("../src/lib/agentEngine");

describe("agentEngine — summarizeLedger (pure, no database)", () => {
  it("totals deposits, payments, and adjustments separately", () => {
    const transactions = [
      { type: "deposit", amount: 10000 },
      { type: "deposit", amount: 5000 },
      { type: "payment", amount: 3000 },
      { type: "adjustment", amount: -500 },
    ];
    assert.deepEqual(summarizeLedger(transactions), {
      transactionCount: 4,
      deposits: 15000,
      payments: 3000,
      adjustments: -500,
    });
  });

  it("handles an empty ledger", () => {
    assert.deepEqual(summarizeLedger([]), { transactionCount: 0, deposits: 0, payments: 0, adjustments: 0 });
  });
});

describe("agentEngine — summarizeBookingAttribution (pure, no database)", () => {
  it("splits commissioned bookings into pending vs paid, ignoring bookings with no commission", () => {
    const bookings = [
      { id: "b1", agentCommission: { agentCommissionAmount: 500, agentCommissionStatus: "pending" } },
      { id: "b2", agentCommission: { agentCommissionAmount: 800, agentCommissionStatus: "paid" } },
      { id: "b3", agentCommission: { agentCommissionAmount: 200, agentCommissionStatus: "pending" } },
      { id: "b4", agentCommission: null }, // booking attributed to the agent but no commission record yet
    ];
    assert.deepEqual(summarizeBookingAttribution(bookings), {
      totalBookings: 4,
      commissionedBookings: 3,
      pending: { count: 2, amount: 700 },
      paid: { count: 1, amount: 800 },
    });
  });

  it("handles an agent with no attributed bookings", () => {
    assert.deepEqual(summarizeBookingAttribution([]), {
      totalBookings: 0,
      commissionedBookings: 0,
      pending: { count: 0, amount: 0 },
      paid: { count: 0, amount: 0 },
    });
  });
});

describe("agentEngine — resolveAgentContext fails safe on bad input, fails loud on real reads", () => {
  it("returns null immediately for a missing agentId or tenantId (no database touched)", async () => {
    assert.equal(await resolveAgentContext(null, "t1"), null);
    assert.equal(await resolveAgentContext("a1", null), null);
  });

  it("propagates a real read failure rather than returning fabricated data (no DATABASE_URL in this test environment)", async () => {
    await assert.rejects(() => resolveAgentContext("some-agent-id", "some-tenant-id"));
  });
});
