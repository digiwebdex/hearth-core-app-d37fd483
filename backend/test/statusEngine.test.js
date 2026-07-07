require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-at-least-32-characters-long";
process.env.RATE_LIMIT_DISABLED = "true";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../src/app");
const {
  STATUS_REGISTRY,
  WORKFLOW_STATUS_REGISTRY,
  STATUS_SET_IDS,
  getStatusRegistry,
  getStatusSet,
  getCategories,
  getStatusSetsForCategory,
  resolveStatus,
  isKnownStatus,
  validateTransition,
  allowedNextStatuses,
} = require("../src/lib/statusEngine");

const REQUESTED_CATEGORIES = [
  "Booking Status", "Payment Status", "Invoice Status", "Visa Status",
  "Passport Status", "Hotel Status", "Tour Status", "Hajj Status",
  "Lead Status", "Task Status", "Approval Status", "Customer Status", "Agent Status",
];

describe("statusEngine — Status Registry shape", () => {
  it("registers every requested category", () => {
    const categories = getCategories();
    for (const category of REQUESTED_CATEGORIES) {
      assert.ok(categories.includes(category), `missing category: ${category}`);
    }
  });

  it("every status set has an entity, field, confidence, and at least one value with a label and color", () => {
    for (const id of STATUS_SET_IDS) {
      const set = STATUS_REGISTRY[id];
      assert.equal(typeof set.category, "string");
      assert.equal(typeof set.entity, "string");
      assert.equal(typeof set.field, "string");
      assert.ok(["verified", "inferred"].includes(set.confidence), `${id} confidence must be verified|inferred`);
      assert.ok(set.values.length > 0, `${id} must have at least one value`);
      for (const v of set.values) {
        assert.equal(typeof v.value, "string");
        assert.equal(typeof v.label, "string");
        assert.equal(typeof v.color, "string");
      }
    }
  });

  it("Visa Status spans both the general Visa Application and Hajj pilgrim visa lifecycles", () => {
    assert.deepEqual(getStatusSetsForCategory("Visa Status").sort(), ["hajjVisaStatus", "visaApplicationStatus"].sort());
  });

  it("Hajj Status spans both the package and pilgrim lifecycles", () => {
    assert.deepEqual(getStatusSetsForCategory("Hajj Status").sort(), ["hajjPackageStatus", "hajjPilgrimStatus"].sort());
  });

  it("Customer Status spans both the account-lifecycle and loyalty-tier readings", () => {
    assert.deepEqual(getStatusSetsForCategory("Customer Status").sort(), ["customerStatus", "loyaltyTier"].sort());
  });
});

describe("statusEngine — verified value sets match the live code exactly", () => {
  it("bookingStatus has the 7 statuses from docs/v2-master/05-Workflow-Book.md", () => {
    assert.deepEqual(
      getStatusSet("bookingStatus").values.map((v) => v.value),
      ["inquiry", "pending", "confirmed", "ticketed", "traveling", "completed", "cancelled"],
    );
  });

  it("invoiceStatus has the 6 statuses from the Invoice type", () => {
    assert.deepEqual(
      getStatusSet("invoiceStatus").values.map((v) => v.value),
      ["unpaid", "partial", "paid", "overdue", "refunded", "cancelled"],
    );
  });

  it("leadStatus has the 6 statuses from the Lead pipeline", () => {
    assert.deepEqual(
      getStatusSet("leadStatus").values.map((v) => v.value),
      ["new", "contacted", "qualified", "quoted", "won", "lost"],
    );
  });

  it("taskStatus matches the Task interface's 3-state union", () => {
    assert.deepEqual(getStatusSet("taskStatus").values.map((v) => v.value), ["todo", "in_progress", "done"]);
  });

  it("agentStatus matches the AgentStatus 2-state union", () => {
    assert.deepEqual(getStatusSet("agentStatus").values.map((v) => v.value), ["active", "inactive"]);
  });

  it("hajjPackageStatus matches PKG_STATUS_META exactly (5 states)", () => {
    assert.deepEqual(
      getStatusSet("hajjPackageStatus").values.map((v) => v.value),
      ["upcoming", "active", "departed", "completed", "closed"],
    );
  });

  it("hajjPilgrimStatus matches PILGRIM_STATUS_META exactly (7 states)", () => {
    assert.deepEqual(
      getStatusSet("hajjPilgrimStatus").values.map((v) => v.value),
      ["registered", "documents_pending", "visa_processing", "confirmed", "departed", "completed", "cancelled"],
    );
  });

  it("hajjVisaStatus matches VISA_STATUS_META exactly (5 states)", () => {
    assert.deepEqual(
      getStatusSet("hajjVisaStatus").values.map((v) => v.value),
      ["not_started", "documents_collected", "submitted", "approved", "rejected"],
    );
  });

  it("visaApplicationStatus matches VisaTracker.tsx's STAGES exactly (6 states)", () => {
    assert.deepEqual(
      getStatusSet("visaApplicationStatus").values.map((v) => v.value),
      ["not_applied", "applied", "in_progress", "approved", "rejected", "collected"],
    );
  });

  it("hotelStatus matches Inventory.tsx's hotel <option> list exactly (3 states)", () => {
    assert.deepEqual(getStatusSet("hotelStatus").values.map((v) => v.value), ["active", "inactive", "expired"]);
  });

  it("tourStatus matches the GroupTour 4-state union", () => {
    assert.deepEqual(
      getStatusSet("tourStatus").values.map((v) => v.value),
      ["upcoming", "ongoing", "completed", "cancelled"],
    );
  });

  it("approvalStatus matches the TravelApprovalRequest 4-state union", () => {
    assert.deepEqual(
      getStatusSet("approvalStatus").values.map((v) => v.value),
      ["pending", "approved", "rejected", "cancelled"],
    );
  });
});

describe("statusEngine — Workflow Status Registry integrity", () => {
  it("every status value has a workflow entry (stage + nextStatuses)", () => {
    for (const id of STATUS_SET_IDS) {
      const workflow = WORKFLOW_STATUS_REGISTRY[id];
      assert.ok(workflow, `${id} has no workflow entry at all`);
      for (const v of STATUS_REGISTRY[id].values) {
        assert.ok(workflow[v.value], `${id}.${v.value} has no workflow entry`);
      }
    }
  });

  it("every documented nextStatus actually exists in its own status set (no dangling references)", () => {
    for (const id of STATUS_SET_IDS) {
      const knownValues = new Set(STATUS_REGISTRY[id].values.map((v) => v.value));
      for (const [value, meta] of Object.entries(WORKFLOW_STATUS_REGISTRY[id])) {
        for (const next of meta.nextStatuses) {
          assert.ok(knownValues.has(next), `${id}.${value} -> "${next}" is not a real value in ${id}`);
        }
      }
    }
  });

  it("terminal_positive/terminal_negative stages generally have few or no next statuses (documented, not enforced)", () => {
    // Spot-check rather than a blanket rule — some terminal states document a
    // real reopen/refund path (e.g. invoice paid -> refunded).
    assert.deepEqual(WORKFLOW_STATUS_REGISTRY.leadStatus.won.nextStatuses, []);
    assert.deepEqual(WORKFLOW_STATUS_REGISTRY.leadStatus.lost.nextStatuses, []);
    assert.deepEqual(WORKFLOW_STATUS_REGISTRY.bookingStatus.completed.nextStatuses, []);
  });
});

describe("statusEngine — Status Resolver (Final Status Context)", () => {
  it("resolves a known booking status to its full context", () => {
    const context = resolveStatus("bookingStatus", "confirmed");
    assert.equal(context.category, "Booking Status");
    assert.equal(context.entity, "Booking");
    assert.equal(context.currentStatus, "confirmed");
    assert.equal(context.label, "Confirmed");
    assert.equal(context.stage, "in_progress");
    assert.deepEqual(context.allowedNextStatuses, ["ticketed", "cancelled"]);
    assert.equal(context.known, true);
    assert.equal(context.confidence, "verified");
  });

  it("returns null for an unknown status set", () => {
    assert.equal(resolveStatus("notARealStatusSet", "whatever"), null);
  });

  it("returns a graceful context (known:false) for an unknown value within a real status set", () => {
    const context = resolveStatus("bookingStatus", "not-a-real-status");
    assert.equal(context.known, false);
    assert.equal(context.label, "not-a-real-status");
    assert.deepEqual(context.allowedNextStatuses, []);
  });
});

describe("GET /api/status-engine", () => {
  const app = createApp();

  it("requires authentication (401 without a token)", async () => {
    const res = await request(app).get("/api/status-engine");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });

  it("requires authentication on /categories (401 without a token)", async () => {
    const res = await request(app).get("/api/status-engine/categories");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });

  it("requires authentication on /:statusSetId (401 without a token)", async () => {
    const res = await request(app).get("/api/status-engine/bookingStatus");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });

  it("requires authentication on /:statusSetId/resolve/:value (401 without a token)", async () => {
    const res = await request(app).get("/api/status-engine/bookingStatus/resolve/confirmed");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });
});

describe("statusEngine — transition enforcement (Booking Engine milestone)", () => {
  it("allows documented forward booking transitions", () => {
    assert.equal(validateTransition("bookingStatus", "inquiry", "pending").ok, true);
    assert.equal(validateTransition("bookingStatus", "pending", "confirmed").ok, true);
    assert.equal(validateTransition("bookingStatus", "confirmed", "ticketed").ok, true);
    assert.equal(validateTransition("bookingStatus", "ticketed", "traveling").ok, true);
    assert.equal(validateTransition("bookingStatus", "traveling", "completed").ok, true);
    assert.equal(validateTransition("bookingStatus", "confirmed", "cancelled").ok, true);
  });

  it("rejects free-text / unknown status values (no more verbatim writes)", () => {
    const r = validateTransition("bookingStatus", "confirmed", "banana");
    assert.equal(r.ok, false);
    assert.equal(r.reason, "unknown_status");
  });

  it("rejects illegal jumps and reopening terminal states", () => {
    assert.equal(validateTransition("bookingStatus", "inquiry", "completed").ok, false);
    assert.equal(validateTransition("bookingStatus", "completed", "pending").ok, false);
    const r = validateTransition("bookingStatus", "cancelled", "confirmed");
    assert.equal(r.ok, false);
    assert.equal(r.reason, "invalid_transition");
  });

  it("treats a no-op (same status) as valid", () => {
    assert.equal(validateTransition("bookingStatus", "confirmed", "confirmed").ok, true);
  });

  it("never traps legacy/unknown current values (allows any known target)", () => {
    assert.equal(validateTransition("bookingStatus", "legacy_value", "confirmed").ok, true);
    assert.equal(validateTransition("bookingStatus", null, "inquiry").ok, true);
  });

  it("exposes helpers used by callers/UI", () => {
    assert.equal(isKnownStatus("bookingStatus", "ticketed"), true);
    assert.equal(isKnownStatus("bookingStatus", "nope"), false);
    assert.deepEqual(allowedNextStatuses("bookingStatus", "pending"), ["confirmed", "cancelled"]);
  });

  it("does not block writes for an unknown status-set id (caller/config error, not user input)", () => {
    assert.equal(validateTransition("notARealSet", "a", "b").ok, true);
  });
});
