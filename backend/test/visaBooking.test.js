require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-at-least-32-characters-long";
process.env.RATE_LIMIT_DISABLED = "true";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../src/app");
const { resolveBookingContext } = require("../src/lib/bookingRegistry");
const {
  BOOKING_TYPE_ID,
  BOOKING_TYPE_VALUE,
  SERVICE_TYPE_VALUE,
  VISA_FIELDS,
  resolveVisaDomain,
} = require("../src/lib/visaDomain");
const { validateVisaBooking } = require("../src/lib/visaBookingValidation");
const { resolveCustomerContext } = require("../src/lib/customerEngine");

const FUTURE_DATE = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const PAST_DATE = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const VALID_PAYLOAD = {
  clientId: "some-client-id",
  visaCountry: "UAE",
  visaType: "Tourist",
  passportNumber: "AB1234567",
  passportExpiry: FUTURE_DATE,
};

describe("visaDomain — Visa Booking Domain", () => {
  it("ported the exact 10 fields from types.ts's Visa section, not invented ones", () => {
    assert.deepEqual(
      VISA_FIELDS.map((f) => f.key).sort(),
      ["appointmentDate", "applicationDate", "expectedApprovalDate", "passportExpiry", "passportNumber", "serviceFee", "submissionDate", "visaCountry", "visaFee", "visaType"].sort(),
    );
  });

  it("marks exactly the truly required fields as required", () => {
    const required = VISA_FIELDS.filter((f) => f.required).map((f) => f.key).sort();
    assert.deepEqual(required, ["passportExpiry", "passportNumber", "visaCountry", "visaType"].sort());
  });

  it("registry id, Booking.type, and Booking.serviceType are all literally 'visa'", () => {
    assert.equal(BOOKING_TYPE_ID, "visa");
    assert.equal(BOOKING_TYPE_VALUE, "visa");
    assert.equal(SERVICE_TYPE_VALUE, "visa");
  });

  it("composes Booking Registry's context (including its visaApplicationStatus cross-reference) rather than duplicating it", () => {
    assert.deepEqual(resolveVisaDomain().bookingContext, resolveBookingContext("visa"));
    assert.ok(resolveVisaDomain().bookingContext.statusFlow.additional.some((s) => s.id === "visaApplicationStatus"));
  });
});

describe("visaBookingValidation — real business rules (pure, no database)", () => {
  it("accepts a fully valid payload", () => {
    assert.deepEqual(validateVisaBooking(VALID_PAYLOAD), { valid: true, errors: [] });
  });

  it("requires visaCountry and visaType", () => {
    assert.equal(validateVisaBooking({ ...VALID_PAYLOAD, visaCountry: "" }).valid, false);
    assert.equal(validateVisaBooking({ ...VALID_PAYLOAD, visaType: "" }).valid, false);
  });

  it("requires clientId or clientName", () => {
    const { clientId, ...withoutClient } = VALID_PAYLOAD;
    assert.equal(validateVisaBooking(withoutClient).valid, false);
    assert.equal(validateVisaBooking({ ...withoutClient, clientName: "Jane Doe" }).valid, true);
  });

  it("validates passportNumber is 6-9 alphanumeric characters", () => {
    assert.equal(validateVisaBooking({ ...VALID_PAYLOAD, passportNumber: "AB1" }).valid, false);
    assert.equal(validateVisaBooking({ ...VALID_PAYLOAD, passportNumber: "TOOLONGPASSPORT" }).valid, false);
    assert.equal(validateVisaBooking({ ...VALID_PAYLOAD, passportNumber: "AB-1234" }).valid, false);
    assert.equal(validateVisaBooking({ ...VALID_PAYLOAD, passportNumber: "AB123456" }).valid, true);
  });

  it("requires a passportExpiry in the future — a real rule Air Ticket didn't need", () => {
    assert.equal(validateVisaBooking({ ...VALID_PAYLOAD, passportExpiry: "" }).valid, false);
    assert.equal(validateVisaBooking({ ...VALID_PAYLOAD, passportExpiry: "not-a-date" }).valid, false);
    const expired = validateVisaBooking({ ...VALID_PAYLOAD, passportExpiry: PAST_DATE });
    assert.equal(expired.valid, false);
    assert.ok(expired.errors.some((e) => e.includes("expired")));
    assert.equal(validateVisaBooking({ ...VALID_PAYLOAD, passportExpiry: FUTURE_DATE }).valid, true);
  });

  it("validates optional dates when provided", () => {
    for (const field of ["applicationDate", "appointmentDate", "submissionDate", "expectedApprovalDate"]) {
      assert.equal(validateVisaBooking({ ...VALID_PAYLOAD, [field]: "not-a-date" }).valid, false, `${field} should be validated`);
      assert.equal(validateVisaBooking({ ...VALID_PAYLOAD, [field]: FUTURE_DATE }).valid, true, `${field} should accept a valid date`);
    }
  });

  it("validates visaFee and serviceFee are non-negative when provided", () => {
    assert.equal(validateVisaBooking({ ...VALID_PAYLOAD, visaFee: -10 }).valid, false);
    assert.equal(validateVisaBooking({ ...VALID_PAYLOAD, serviceFee: -5 }).valid, false);
    assert.equal(validateVisaBooking({ ...VALID_PAYLOAD, visaFee: 100, serviceFee: 20 }).valid, true);
  });

  it("collects every violated rule at once, not just the first", () => {
    const { valid, errors } = validateVisaBooking({ visaCountry: "", visaType: "" });
    assert.equal(valid, false);
    assert.ok(errors.length >= 3);
  });
});

describe("customerEngine — extended for Passport Information without breaking its existing contract", () => {
  it("still fails safe on bad input (no database touched)", async () => {
    assert.equal(await resolveCustomerContext(null, "t1"), null);
  });

  it("still propagates a real read failure rather than fabricating data", async () => {
    await assert.rejects(() => resolveCustomerContext("some-client-id", "some-tenant-id"));
  });
});

describe("GET/POST/PATCH/DELETE /api/visa-bookings — all routes require authentication", () => {
  const app = createApp();

  const cases = [
    ["get", "/api/visa-bookings/domain"],
    ["get", "/api/visa-bookings"],
    ["get", "/api/visa-bookings/some-id"],
    ["post", "/api/visa-bookings"],
    ["patch", "/api/visa-bookings/some-id"],
    ["delete", "/api/visa-bookings/some-id"],
    ["get", "/api/visa-bookings/some-id/tracking"],
    ["post", "/api/visa-bookings/some-id/tracking"],
    ["patch", "/api/visa-bookings/some-id/tracking"],
    ["get", "/api/visa-bookings/some-id/passport"],
    ["get", "/api/visa-bookings/some-id/documents"],
    ["post", "/api/visa-bookings/some-id/documents"],
    ["patch", "/api/visa-bookings/some-id/documents/some-doc-id"],
    ["get", "/api/visa-bookings/some-id/timeline"],
    ["post", "/api/visa-bookings/some-id/timeline"],
    ["get", "/api/visa-bookings/some-id/notes"],
    ["post", "/api/visa-bookings/some-id/notes"],
    ["get", "/api/visa-bookings/some-id/attachments"],
    ["post", "/api/visa-bookings/some-id/attachments"],
    ["delete", "/api/visa-bookings/some-id/attachments/some-attachment-id"],
  ];

  for (const [method, path] of cases) {
    it(`requires authentication on ${method.toUpperCase()} ${path} (401 without a token)`, async () => {
      const res = await request(app)[method](path);
      assert.equal(res.status, 401);
      assert.match(res.body.message, /token/i);
    });
  }
});
