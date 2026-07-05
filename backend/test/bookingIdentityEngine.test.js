require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-at-least-32-characters-long";
process.env.RATE_LIMIT_DISABLED = "true";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../src/app");
const { BOOKING_TYPE_IDS } = require("../src/lib/bookingRegistry");
const {
  BOOKING_TYPE_CODES,
  isSupportedBookingType,
  generateBookingNumber,
  generateBookingReference,
  generatePublicReference,
  generateQrReference,
  resolveIdentity,
  previewNextBookingIdentity,
} = require("../src/lib/bookingIdentityEngine");

describe("bookingIdentityEngine — BOOKING_TYPE_CODES cross-reference integrity", () => {
  it("has exactly one 2-letter code per Booking Registry type, no more, no less", () => {
    assert.deepEqual(Object.keys(BOOKING_TYPE_CODES).sort(), [...BOOKING_TYPE_IDS].sort());
  });

  it("every code is 2 uppercase letters and codes are unique", () => {
    const codes = Object.values(BOOKING_TYPE_CODES);
    for (const code of codes) assert.match(code, /^[A-Z]{2}$/);
    assert.equal(new Set(codes).size, codes.length, "type codes must be unique");
  });

  it("isSupportedBookingType recognizes all 10 types and rejects unknowns", () => {
    for (const id of BOOKING_TYPE_IDS) assert.equal(isSupportedBookingType(id), true);
    assert.equal(isSupportedBookingType("not-a-real-type"), false);
  });
});

describe("bookingIdentityEngine — generateBookingNumber (pure, no database)", () => {
  it("zero-pads to 6 digits with the BK- prefix", () => {
    assert.equal(generateBookingNumber(1), "BK-000001");
    assert.equal(generateBookingNumber(123), "BK-000123");
    assert.equal(generateBookingNumber(999999), "BK-999999");
  });

  it("clamps a non-positive or missing sequence to 1", () => {
    assert.equal(generateBookingNumber(0), "BK-000001");
    assert.equal(generateBookingNumber(-5), "BK-000001");
    assert.equal(generateBookingNumber(undefined), "BK-000001");
  });
});

describe("bookingIdentityEngine — generateBookingReference (pure, no database)", () => {
  it("formats as TYPECODE-YEAR-SEQUENCE for every supported booking type", () => {
    assert.equal(generateBookingReference({ bookingTypeId: "hajj", year: 2026, sequence: 123 }), "HJ-2026-00123");
    assert.equal(generateBookingReference({ bookingTypeId: "umrah", year: 2026, sequence: 123 }), "UM-2026-00123");
    assert.equal(generateBookingReference({ bookingTypeId: "air_ticket", year: 2026, sequence: 5 }), "AT-2026-00005");
  });

  it("returns null for an unsupported booking type", () => {
    assert.equal(generateBookingReference({ bookingTypeId: "not-a-real-type", year: 2026, sequence: 1 }), null);
  });

  it("defaults year to the current year when omitted", () => {
    const ref = generateBookingReference({ bookingTypeId: "hajj", sequence: 1 });
    assert.match(ref, /^HJ-\d{4}-00001$/);
  });
});

describe("bookingIdentityEngine — generatePublicReference (pure, no database)", () => {
  it("derives an 8-character uppercase code from a UUID, deterministically", () => {
    const ref = generatePublicReference("11111111-2222-3333-4444-abcdef123456");
    assert.match(ref, /^[0-9A-F]{8}$/);
    assert.equal(ref, generatePublicReference("11111111-2222-3333-4444-abcdef123456"));
  });

  it("returns null for a missing id", () => {
    assert.equal(generatePublicReference(null), null);
    assert.equal(generatePublicReference(""), null);
  });
});

describe("bookingIdentityEngine — generateQrReference (pure, no database)", () => {
  it("combines the type code and public reference into a payload + verify path", () => {
    const qr = generateQrReference({ bookingTypeId: "visa", publicReference: "7F3K9QXZ" });
    assert.deepEqual(qr, { payload: "VS-7F3K9QXZ", verifyPath: "/bookings/verify/7F3K9QXZ" });
  });

  it("returns null for an unsupported booking type or a missing public reference", () => {
    assert.equal(generateQrReference({ bookingTypeId: "not-a-real-type", publicReference: "7F3K9QXZ" }), null);
    assert.equal(generateQrReference({ bookingTypeId: "visa", publicReference: null }), null);
  });
});

describe("bookingIdentityEngine — resolveIdentity (pure, no database)", () => {
  it("classifies a booking number", () => {
    assert.deepEqual(resolveIdentity("BK-000123"), { format: "bookingNumber", value: "BK-000123", sequence: 123 });
  });

  it("classifies and decodes a booking reference", () => {
    assert.deepEqual(resolveIdentity("HJ-2026-00123"), {
      format: "bookingReference",
      value: "HJ-2026-00123",
      bookingTypeId: "hajj",
      typeCode: "HJ",
      year: 2026,
      sequence: 123,
    });
  });

  it("classifies and decodes a QR reference payload", () => {
    assert.deepEqual(resolveIdentity("AT-7F3K9QXZ"), {
      format: "qrReference",
      value: "AT-7F3K9QXZ",
      bookingTypeId: "air_ticket",
      typeCode: "AT",
      publicReference: "7F3K9QXZ",
    });
  });

  it("classifies a bare public reference", () => {
    assert.deepEqual(resolveIdentity("7F3K9QXZ"), { format: "publicReference", value: "7F3K9QXZ", publicReference: "7F3K9QXZ" });
  });

  it("falls back to 'unknown' for anything unrecognized, without throwing", () => {
    assert.deepEqual(resolveIdentity("not-a-real-identity!!"), { format: "unknown", value: "not-a-real-identity!!" });
    assert.equal(resolveIdentity(null).format, "unknown");
  });

  it("round-trips generateBookingReference -> resolveIdentity for every supported booking type", () => {
    for (const bookingTypeId of BOOKING_TYPE_IDS) {
      const reference = generateBookingReference({ bookingTypeId, year: 2026, sequence: 42 });
      const resolved = resolveIdentity(reference);
      assert.equal(resolved.format, "bookingReference");
      assert.equal(resolved.bookingTypeId, bookingTypeId);
      assert.equal(resolved.year, 2026);
      assert.equal(resolved.sequence, 42);
    }
  });
});

describe("bookingIdentityEngine — previewNextBookingIdentity fails safe on bad input, fails loud on real reads", () => {
  it("returns null immediately for an unsupported booking type or missing tenantId (no database touched)", async () => {
    assert.equal(await previewNextBookingIdentity("not-a-real-type", "t1"), null);
    assert.equal(await previewNextBookingIdentity("hajj", null), null);
  });

  it("propagates a real read failure rather than returning fabricated data (no DATABASE_URL in this test environment)", async () => {
    await assert.rejects(() => previewNextBookingIdentity("hajj", "some-tenant-id"));
  });
});

describe("GET /api/booking-identity", () => {
  const app = createApp();

  it("requires authentication on /types (401 without a token)", async () => {
    const res = await request(app).get("/api/booking-identity/types");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });

  it("requires authentication on /preview/:bookingTypeId (401 without a token)", async () => {
    const res = await request(app).get("/api/booking-identity/preview/hajj");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });

  it("requires authentication on /resolve/:identity (401 without a token)", async () => {
    const res = await request(app).get("/api/booking-identity/resolve/BK-000123");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });
});
