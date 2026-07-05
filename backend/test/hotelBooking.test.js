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
  HOTEL_FIELDS,
  resolveHotelDomain,
} = require("../src/lib/hotelDomain");
const {
  ROOM_TYPES,
  computeNights,
  validateHotelBooking,
  validateRoomAssignment,
  addRoom,
  removeRoom,
} = require("../src/lib/hotelBookingValidation");

const VALID_PAYLOAD = {
  clientId: "some-client-id",
  hotelName: "Grand Hilton",
  checkInDate: "2026-05-01",
  checkOutDate: "2026-05-04",
};

describe("hotelDomain — Hotel Booking Domain", () => {
  it("ported the exact 9 fields from types.ts's Hotel section, not invented ones", () => {
    assert.deepEqual(
      HOTEL_FIELDS.map((f) => f.key).sort(),
      ["checkInDate", "checkOutDate", "confirmationNumber", "guestCount", "hotelCity", "hotelCountry", "hotelName", "roomCount", "roomType"].sort(),
    );
  });

  it("marks exactly hotelName + check-in/out as required", () => {
    const required = HOTEL_FIELDS.filter((f) => f.required).map((f) => f.key).sort();
    assert.deepEqual(required, ["checkInDate", "checkOutDate", "hotelName"].sort());
  });

  it("registry id, Booking.type, and Booking.serviceType are all 'hotel'", () => {
    assert.equal(BOOKING_TYPE_ID, "hotel");
    assert.equal(BOOKING_TYPE_VALUE, "hotel");
    assert.equal(SERVICE_TYPE_VALUE, "hotel");
  });

  it("composes Booking Registry's context (with its hotelStatus cross-reference) rather than duplicating it", () => {
    assert.deepEqual(resolveHotelDomain().bookingContext, resolveBookingContext("hotel"));
    assert.ok(resolveHotelDomain().bookingContext.statusFlow.additional.some((s) => s.id === "hotelStatus"));
  });
});

describe("hotelBookingValidation — computeNights (pure)", () => {
  it("counts whole nights between check-in and check-out", () => {
    assert.equal(computeNights("2026-05-01", "2026-05-04"), 3);
    assert.equal(computeNights("2026-05-01", "2026-05-02"), 1);
  });
  it("returns 0 for a same-day or invalid range", () => {
    assert.equal(computeNights("2026-05-01", "2026-05-01"), 0);
    assert.equal(computeNights("2026-05-01", "not-a-date"), 0);
    assert.equal(computeNights(null, "2026-05-04"), 0);
  });
});

describe("hotelBookingValidation — validateHotelBooking (pure)", () => {
  it("accepts a fully valid payload", () => {
    assert.deepEqual(validateHotelBooking(VALID_PAYLOAD), { valid: true, errors: [] });
  });

  it("requires hotelName", () => {
    assert.equal(validateHotelBooking({ ...VALID_PAYLOAD, hotelName: "" }).valid, false);
  });

  it("requires clientId or clientName", () => {
    const { clientId, ...withoutClient } = VALID_PAYLOAD;
    assert.equal(validateHotelBooking(withoutClient).valid, false);
    assert.equal(validateHotelBooking({ ...withoutClient, clientName: "Jane" }).valid, true);
  });

  it("requires valid check-in and check-out dates", () => {
    assert.equal(validateHotelBooking({ ...VALID_PAYLOAD, checkInDate: "" }).valid, false);
    assert.equal(validateHotelBooking({ ...VALID_PAYLOAD, checkOutDate: "nope" }).valid, false);
  });

  it("requires checkOutDate to be strictly after checkInDate — a real hotel rule", () => {
    assert.equal(validateHotelBooking({ ...VALID_PAYLOAD, checkOutDate: VALID_PAYLOAD.checkInDate }).valid, false, "same day should fail");
    assert.equal(validateHotelBooking({ ...VALID_PAYLOAD, checkInDate: "2026-05-04", checkOutDate: "2026-05-01" }).valid, false, "reversed should fail");
    assert.equal(validateHotelBooking({ ...VALID_PAYLOAD, checkOutDate: "2026-05-05" }).valid, true);
  });

  it("validates roomType, roomCount, guestCount, and amount when provided", () => {
    assert.equal(validateHotelBooking({ ...VALID_PAYLOAD, roomType: "penthouse" }).valid, false);
    assert.equal(validateHotelBooking({ ...VALID_PAYLOAD, roomType: "suite" }).valid, true);
    assert.equal(validateHotelBooking({ ...VALID_PAYLOAD, roomCount: 0 }).valid, false);
    assert.equal(validateHotelBooking({ ...VALID_PAYLOAD, guestCount: 0 }).valid, false);
    assert.equal(validateHotelBooking({ ...VALID_PAYLOAD, amount: -1 }).valid, false);
  });

  it("exposes the real RoomType union from types.ts", () => {
    assert.deepEqual([...ROOM_TYPES].sort(), ["double", "other", "single", "suite", "triple", "twin"].sort());
  });
});

describe("hotelBookingValidation — room assignment (pure)", () => {
  it("requires a roomNumber", () => {
    assert.equal(validateRoomAssignment({}).valid, false);
    assert.equal(validateRoomAssignment({ roomNumber: "101" }).valid, true);
  });

  it("validates roomType and guestNames shape when provided", () => {
    assert.equal(validateRoomAssignment({ roomNumber: "101", roomType: "penthouse" }).valid, false);
    assert.equal(validateRoomAssignment({ roomNumber: "101", guestNames: "Jane" }).valid, false);
    assert.equal(validateRoomAssignment({ roomNumber: "101", roomType: "double", guestNames: ["Jane", "John"] }).valid, true);
  });

  it("addRoom returns a NEW array with a normalized room", () => {
    const original = [];
    const next = addRoom(original, { id: "r1", roomNumber: " 101 ", roomType: "double", guestNames: [" Jane ", ""] });
    assert.equal(original.length, 0, "must not mutate the original");
    assert.equal(next.length, 1);
    assert.equal(next[0].roomNumber, "101");
    assert.deepEqual(next[0].guestNames, ["Jane"]);
  });

  it("removeRoom removes by id, returning a NEW array", () => {
    const rooms = [{ id: "r1", roomNumber: "101" }, { id: "r2", roomNumber: "102" }];
    const after = removeRoom(rooms, "r1");
    assert.equal(after.length, 1);
    assert.equal(after[0].id, "r2");
    assert.equal(rooms.length, 2, "must not mutate the original");
  });
});

describe("GET/POST/PATCH/DELETE /api/hotel-bookings — all routes require authentication", () => {
  const app = createApp();

  const cases = [
    ["get", "/api/hotel-bookings/domain"],
    ["get", "/api/hotel-bookings"],
    ["get", "/api/hotel-bookings/some-id"],
    ["post", "/api/hotel-bookings"],
    ["patch", "/api/hotel-bookings/some-id"],
    ["delete", "/api/hotel-bookings/some-id"],
    ["get", "/api/hotel-bookings/some-id/reservation"],
    ["post", "/api/hotel-bookings/some-id/reservation"],
    ["get", "/api/hotel-bookings/some-id/voucher"],
    ["get", "/api/hotel-bookings/some-id/rooms"],
    ["post", "/api/hotel-bookings/some-id/rooms"],
    ["delete", "/api/hotel-bookings/some-id/rooms/some-room-id"],
    ["post", "/api/hotel-bookings/some-id/check-in"],
    ["post", "/api/hotel-bookings/some-id/check-out"],
    ["get", "/api/hotel-bookings/some-id/timeline"],
    ["post", "/api/hotel-bookings/some-id/timeline"],
    ["get", "/api/hotel-bookings/some-id/notes"],
    ["post", "/api/hotel-bookings/some-id/notes"],
    ["get", "/api/hotel-bookings/some-id/documents"],
  ];

  for (const [method, path] of cases) {
    it(`requires authentication on ${method.toUpperCase()} ${path} (401 without a token)`, async () => {
      const res = await request(app)[method](path);
      assert.equal(res.status, 401);
      assert.match(res.body.message, /token/i);
    });
  }
});
