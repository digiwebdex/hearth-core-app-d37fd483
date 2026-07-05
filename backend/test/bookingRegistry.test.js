require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-at-least-32-characters-long";
process.env.RATE_LIMIT_DISABLED = "true";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../src/app");
const { SERVICE_TYPES } = require("../src/constants/serviceTypes");
const { SUPPLIER_CATEGORIES } = require("../src/lib/supplierEngine");
const { getStatusSet, STATUS_SET_IDS } = require("../src/lib/statusEngine");
const {
  BOOKING_TYPE_IDS,
  BOOKING_WORKFLOW_PIPELINE,
  getBookingRegistry,
  getBookingType,
  resolveServiceType,
  resolveBookingContext,
} = require("../src/lib/bookingRegistry");

const APPROVED_BOOKING_TYPES = [
  "air_ticket", "visa", "hajj", "umrah", "tour", "hotel",
  "transport", "insurance", "student_consultancy", "overseas_manpower",
];

describe("bookingRegistry — Booking Type Registry shape", () => {
  it("registers exactly the 10 approved booking types", () => {
    assert.deepEqual([...BOOKING_TYPE_IDS].sort(), [...APPROVED_BOOKING_TYPES].sort());
  });

  it("every booking type has the full required shape", () => {
    for (const id of BOOKING_TYPE_IDS) {
      const type = getBookingType(id);
      assert.equal(typeof type.label, "string");
      assert.ok(Array.isArray(type.serviceTypes) && type.serviceTypes.length > 0, `${id} needs serviceTypes`);
      assert.equal(typeof type.bookingCategory, "string");
      assert.ok(Array.isArray(type.requiredCustomerType.allowed));
      assert.ok(Array.isArray(type.requiredSupplierType.allowed));
      assert.equal(typeof type.statusFlow.bookingStatusSetId, "string");
      assert.ok(Array.isArray(type.statusFlow.additionalStatusSetIds));
    }
  });
});

describe("bookingRegistry — cross-reference integrity (no dangling references)", () => {
  it("every serviceTypes value is one of the 14 real SERVICE_TYPES — nothing invented", () => {
    for (const id of BOOKING_TYPE_IDS) {
      for (const serviceType of getBookingType(id).serviceTypes) {
        assert.ok(SERVICE_TYPES.includes(serviceType), `${id} references unknown service type "${serviceType}"`);
      }
    }
  });

  it("every requiredSupplierType value is a real Supplier Engine category", () => {
    const knownCategories = new Set(SUPPLIER_CATEGORIES.map((c) => c.value));
    for (const id of BOOKING_TYPE_IDS) {
      for (const category of getBookingType(id).requiredSupplierType.allowed) {
        assert.ok(knownCategories.has(category), `${id} references unknown supplier category "${category}"`);
      }
    }
  });

  it("every statusFlow set id (bookingStatusSetId + additionalStatusSetIds) is a real, registered Status Engine set", () => {
    for (const id of BOOKING_TYPE_IDS) {
      const type = getBookingType(id);
      assert.ok(STATUS_SET_IDS.includes(type.statusFlow.bookingStatusSetId), `${id} references unknown status set`);
      for (const setId of type.statusFlow.additionalStatusSetIds) {
        assert.ok(STATUS_SET_IDS.includes(setId), `${id} references unknown additional status set "${setId}"`);
      }
    }
  });
});

describe("bookingRegistry — Hajj vs Umrah disambiguation", () => {
  it("both share the hajj_umrah service type and the same Hajj status sets", () => {
    const hajj = getBookingType("hajj");
    const umrah = getBookingType("umrah");
    assert.deepEqual(hajj.serviceTypes, ["hajj_umrah"]);
    assert.deepEqual(umrah.serviceTypes, ["hajj_umrah"]);
    assert.deepEqual(hajj.statusFlow.additionalStatusSetIds, umrah.statusFlow.additionalStatusSetIds);
  });

  it("are distinguished by packageTypeValue, matching HajjPackageType exactly", () => {
    assert.equal(getBookingType("hajj").packageTypeValue, "hajj");
    assert.equal(getBookingType("umrah").packageTypeValue, "umrah");
  });
});

describe("bookingRegistry — Service Type Resolver", () => {
  it("resolves a known booking type to its service type(s)", () => {
    assert.deepEqual(resolveServiceType("air_ticket"), {
      bookingTypeId: "air_ticket",
      serviceTypes: ["air_ticket"],
      packageTypeValue: null,
    });
  });

  it("resolves tour to both of its service types", () => {
    assert.deepEqual(resolveServiceType("tour").serviceTypes, ["tour_domestic", "tour_international"]);
  });

  it("returns null for an unknown booking type", () => {
    assert.equal(resolveServiceType("not-a-real-type"), null);
  });
});

describe("bookingRegistry — Booking Context Resolver (the full chain)", () => {
  it("composes the universal workflow pipeline for every booking type", () => {
    for (const id of BOOKING_TYPE_IDS) {
      assert.deepEqual(resolveBookingContext(id).workflow, BOOKING_WORKFLOW_PIPELINE);
    }
  });

  it("composes the real Status Engine bookingStatus set, not a copy", () => {
    const context = resolveBookingContext("hajj");
    assert.deepEqual(context.statusFlow.bookingStatus, getStatusSet("bookingStatus"));
  });

  it("composes every additional status set for a multi-status booking type (Hajj)", () => {
    const context = resolveBookingContext("hajj");
    assert.equal(context.statusFlow.additional.length, 3);
    const ids = context.statusFlow.additional.map((s) => s.id);
    assert.deepEqual(ids.sort(), ["hajjPackageStatus", "hajjPilgrimStatus", "hajjVisaStatus"].sort());
  });

  it("composes the real Status Engine payment/invoice status sets", () => {
    const context = resolveBookingContext("air_ticket");
    assert.deepEqual(context.paymentFlow.paymentStatus, getStatusSet("paymentStatus"));
    assert.deepEqual(context.paymentFlow.invoiceStatus, getStatusSet("invoiceStatus"));
  });

  it("returns null for an unknown booking type", () => {
    assert.equal(resolveBookingContext("not-a-real-type"), null);
  });
});

describe("bookingRegistry — read-only, does not mutate anything", () => {
  it("getBookingRegistry() is the same static object every call (no per-call construction/mutation)", () => {
    assert.strictEqual(getBookingRegistry(), getBookingRegistry());
  });
});

describe("GET /api/booking-registry", () => {
  const app = createApp();

  it("requires authentication (401 without a token)", async () => {
    const res = await request(app).get("/api/booking-registry");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });

  it("requires authentication on /:bookingTypeId (401 without a token)", async () => {
    const res = await request(app).get("/api/booking-registry/hajj");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });

  it("requires authentication on /:bookingTypeId/service-type (401 without a token)", async () => {
    const res = await request(app).get("/api/booking-registry/hajj/service-type");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });
});
