require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-at-least-32-characters-long";
process.env.RATE_LIMIT_DISABLED = "true";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../src/app");
const bookingsRouter = require("../src/routes/bookings");
const { resolveBookingContext } = require("../src/lib/bookingRegistry");
const {
  BOOKING_TYPE_ID,
  BOOKING_TYPE_VALUE,
  SERVICE_TYPE_VALUE,
  AIR_TICKET_FIELDS,
  resolveAirTicketDomain,
} = require("../src/lib/airTicketDomain");
const { validateAirTicketBooking } = require("../src/lib/airTicketBookingValidation");

const VALID_PAYLOAD = {
  clientId: "some-client-id",
  airline: "Emirates",
  flightNumber: "EK585",
  pnrNumber: "ABC123",
  fromCity: "DAC",
  toCity: "DXB",
  departureDate: "2026-08-01",
};

describe("bookings.js — additive exports don't disturb the existing router", () => {
  it("still exports a usable Express router as the module's callable value", () => {
    assert.equal(typeof bookingsRouter, "function");
    assert.ok(Array.isArray(bookingsRouter.stack), "should still have Express router internals");
  });

  it("additively exposes the helpers airTicketBookings.js needs, without removing anything", () => {
    for (const key of ["normalizeBookingInput", "formatBooking", "getTenantBooking", "BOOKING_LIST_INCLUDE", "BOOKING_DETAIL_INCLUDE", "syncAgentCommission", "upload"]) {
      assert.ok(key in bookingsRouter, `bookings.js should export ${key}`);
    }
    assert.equal(typeof bookingsRouter.normalizeBookingInput, "function");
    assert.equal(typeof bookingsRouter.formatBooking, "function");
  });
});

describe("airTicketDomain — Air Ticket Booking Domain", () => {
  it("ported the exact 10 fields from TicketFields.tsx/types.ts, not invented ones", () => {
    assert.deepEqual(
      AIR_TICKET_FIELDS.map((f) => f.key).sort(),
      ["airline", "cabinClass", "departureDate", "flightNumber", "fromCity", "isRoundTrip", "pnrNumber", "returnDate", "ticketDeadline", "toCity"].sort(),
    );
  });

  it("marks exactly the truly required fields as required", () => {
    const required = AIR_TICKET_FIELDS.filter((f) => f.required).map((f) => f.key).sort();
    assert.deepEqual(required, ["airline", "departureDate", "flightNumber", "fromCity", "pnrNumber", "toCity"].sort());
  });

  it("distinguishes the Booking Registry abstract id from the real Prisma type/serviceType values", () => {
    assert.equal(BOOKING_TYPE_ID, "air_ticket");
    assert.equal(BOOKING_TYPE_VALUE, "ticket");
    assert.equal(SERVICE_TYPE_VALUE, "air_ticket");
  });

  it("composes Booking Registry's context rather than duplicating it", () => {
    assert.deepEqual(resolveAirTicketDomain().bookingContext, resolveBookingContext("air_ticket"));
  });
});

describe("airTicketBookingValidation — real business rules (pure, no database)", () => {
  it("accepts a fully valid payload", () => {
    assert.deepEqual(validateAirTicketBooking(VALID_PAYLOAD), { valid: true, errors: [] });
  });

  it("requires every core text field", () => {
    for (const field of ["airline", "flightNumber", "pnrNumber", "fromCity", "toCity"]) {
      const { valid, errors } = validateAirTicketBooking({ ...VALID_PAYLOAD, [field]: "" });
      assert.equal(valid, false);
      assert.ok(errors.some((e) => e.includes(field)), `expected an error mentioning ${field}`);
    }
  });

  it("requires clientId or clientName", () => {
    const { clientId, ...withoutClient } = VALID_PAYLOAD;
    const result = validateAirTicketBooking(withoutClient);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("clientId or clientName")));

    const withClientName = validateAirTicketBooking({ ...withoutClient, clientName: "Jane Doe" });
    assert.equal(withClientName.valid, true);
  });

  it("requires a valid departureDate", () => {
    assert.equal(validateAirTicketBooking({ ...VALID_PAYLOAD, departureDate: "" }).valid, false);
    assert.equal(validateAirTicketBooking({ ...VALID_PAYLOAD, departureDate: "not-a-date" }).valid, false);
  });

  it("requires a valid returnDate on or after departureDate when isRoundTrip is true", () => {
    assert.equal(validateAirTicketBooking({ ...VALID_PAYLOAD, isRoundTrip: true }).valid, false);
    assert.equal(
      validateAirTicketBooking({ ...VALID_PAYLOAD, isRoundTrip: true, returnDate: "2026-07-01" }).valid,
      false,
      "returnDate before departureDate should fail",
    );
    assert.equal(
      validateAirTicketBooking({ ...VALID_PAYLOAD, isRoundTrip: true, returnDate: "2026-08-10" }).valid,
      true,
    );
  });

  it("validates pnrNumber is 4-8 alphanumeric characters", () => {
    assert.equal(validateAirTicketBooking({ ...VALID_PAYLOAD, pnrNumber: "AB" }).valid, false);
    assert.equal(validateAirTicketBooking({ ...VALID_PAYLOAD, pnrNumber: "TOOLONGPNR" }).valid, false);
    assert.equal(validateAirTicketBooking({ ...VALID_PAYLOAD, pnrNumber: "AB-12" }).valid, false);
    assert.equal(validateAirTicketBooking({ ...VALID_PAYLOAD, pnrNumber: "AB12CD" }).valid, true);
  });

  it("validates cabinClass is one of economy/business/first when provided", () => {
    assert.equal(validateAirTicketBooking({ ...VALID_PAYLOAD, cabinClass: "premium" }).valid, false);
    assert.equal(validateAirTicketBooking({ ...VALID_PAYLOAD, cabinClass: "business" }).valid, true);
    assert.equal(validateAirTicketBooking(VALID_PAYLOAD).valid, true, "cabinClass is optional");
  });

  it("validates ticketDeadline is a real date when provided", () => {
    assert.equal(validateAirTicketBooking({ ...VALID_PAYLOAD, ticketDeadline: "not-a-date" }).valid, false);
    assert.equal(validateAirTicketBooking({ ...VALID_PAYLOAD, ticketDeadline: "2026-07-20" }).valid, true);
  });

  it("validates travelerCount is at least 1 when provided", () => {
    assert.equal(validateAirTicketBooking({ ...VALID_PAYLOAD, travelerCount: 0 }).valid, false);
    assert.equal(validateAirTicketBooking({ ...VALID_PAYLOAD, travelerCount: -1 }).valid, false);
    assert.equal(validateAirTicketBooking({ ...VALID_PAYLOAD, travelerCount: 2 }).valid, true);
  });

  it("validates amount is non-negative when provided", () => {
    assert.equal(validateAirTicketBooking({ ...VALID_PAYLOAD, amount: -100 }).valid, false);
    assert.equal(validateAirTicketBooking({ ...VALID_PAYLOAD, amount: 0 }).valid, true);
    assert.equal(validateAirTicketBooking({ ...VALID_PAYLOAD, amount: 500 }).valid, true);
  });

  it("collects every violated rule at once, not just the first", () => {
    const { valid, errors } = validateAirTicketBooking({ airline: "", flightNumber: "" });
    assert.equal(valid, false);
    assert.ok(errors.length >= 3);
  });
});

describe("GET/POST/PATCH/DELETE /api/air-ticket-bookings — all routes require authentication", () => {
  const app = createApp();

  const cases = [
    ["get", "/api/air-ticket-bookings/domain"],
    ["get", "/api/air-ticket-bookings"],
    ["get", "/api/air-ticket-bookings/some-id"],
    ["post", "/api/air-ticket-bookings"],
    ["patch", "/api/air-ticket-bookings/some-id"],
    ["delete", "/api/air-ticket-bookings/some-id"],
    ["get", "/api/air-ticket-bookings/some-id/passengers"],
    ["post", "/api/air-ticket-bookings/some-id/passengers"],
    ["delete", "/api/air-ticket-bookings/some-id/passengers/some-passenger-id"],
    ["get", "/api/air-ticket-bookings/some-id/timeline"],
    ["post", "/api/air-ticket-bookings/some-id/timeline"],
    ["get", "/api/air-ticket-bookings/some-id/notes"],
    ["post", "/api/air-ticket-bookings/some-id/notes"],
    ["get", "/api/air-ticket-bookings/some-id/attachments"],
    ["post", "/api/air-ticket-bookings/some-id/attachments"],
    ["delete", "/api/air-ticket-bookings/some-id/attachments/some-attachment-id"],
  ];

  for (const [method, path] of cases) {
    it(`requires authentication on ${method.toUpperCase()} ${path} (401 without a token)`, async () => {
      const res = await request(app)[method](path);
      assert.equal(res.status, 401);
      assert.match(res.body.message, /token/i);
    });
  }
});
