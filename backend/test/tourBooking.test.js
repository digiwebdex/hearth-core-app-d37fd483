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
  BOOKING_TYPE_VALUE,
  TOUR_TYPES,
  TOUR_FIELDS,
  serviceTypeForTourType,
  resolveTourDomain,
} = require("../src/lib/tourDomain");
const {
  validateTourBooking,
  validateTraveller,
  TOUR_COLLECTIONS,
  TOUR_COLLECTION_KEYS,
  addCollectionItem,
  updateCollectionItem,
  removeCollectionItem,
} = require("../src/lib/tourBookingValidation");

const VALID_PAYLOAD = { clientId: "some-client-id", tourType: "domestic" };

describe("tourDomain — Tour Booking Domain", () => {
  it("supports domestic + international in one module and maps each to a real serviceType", () => {
    assert.deepEqual([...TOUR_TYPES].sort(), ["domestic", "international"]);
    assert.equal(BOOKING_TYPE_VALUE, "tour");
    assert.equal(serviceTypeForTourType("domestic"), "tour_domestic");
    assert.equal(serviceTypeForTourType("international"), "tour_international");
    assert.equal(serviceTypeForTourType(undefined), "tour_domestic"); // safe default
  });

  it("exposes tourType as a required field", () => {
    const tt = TOUR_FIELDS.find((f) => f.key === "tourType");
    assert.equal(tt.required, true);
    assert.deepEqual(tt.options, ["domestic", "international"]);
  });

  it("composes Booking Registry's tour context (with its tourStatus cross-reference)", () => {
    assert.deepEqual(resolveTourDomain().bookingContext, resolveBookingContext("tour"));
    assert.ok(resolveTourDomain().bookingContext.statusFlow.additional.some((s) => s.id === "tourStatus"));
  });
});

describe("tourBookingValidation — validateTourBooking (pure)", () => {
  it("accepts a valid domestic and a valid international booking", () => {
    assert.deepEqual(validateTourBooking(VALID_PAYLOAD), { valid: true, errors: [] });
    assert.deepEqual(validateTourBooking({ ...VALID_PAYLOAD, tourType: "international" }), { valid: true, errors: [] });
  });

  it("requires tourType to be domestic or international", () => {
    assert.equal(validateTourBooking({ ...VALID_PAYLOAD, tourType: "space" }).valid, false);
    assert.equal(validateTourBooking({ clientId: "c1" }).valid, false);
  });

  it("requires clientId or clientName", () => {
    assert.equal(validateTourBooking({ tourType: "domestic" }).valid, false);
    assert.equal(validateTourBooking({ tourType: "domestic", clientName: "Karim" }).valid, true);
  });

  it("rejects travelDateTo before travelDateFrom", () => {
    assert.equal(validateTourBooking({ ...VALID_PAYLOAD, travelDateFrom: "2026-06-10", travelDateTo: "2026-06-01" }).valid, false);
    assert.equal(validateTourBooking({ ...VALID_PAYLOAD, travelDateFrom: "2026-06-01", travelDateTo: "2026-06-10" }).valid, true);
  });

  it("rejects a negative amount", () => {
    assert.equal(validateTourBooking({ ...VALID_PAYLOAD, amount: -1 }).valid, false);
  });
});

describe("tourBookingValidation — validateTraveller (pure)", () => {
  it("requires a name and validates passport/dob when provided", () => {
    assert.equal(validateTraveller({}).valid, false);
    assert.equal(validateTraveller({ name: "Karim", passportNumber: "AB1" }).valid, false);
    assert.equal(validateTraveller({ name: "Karim", dateOfBirth: "nope" }).valid, false);
    assert.equal(validateTraveller({ name: "Karim", passportNumber: "AB123456", dateOfBirth: "1990-01-01" }).valid, true);
  });
});

describe("tourBookingValidation — the five sub-collections", () => {
  it("registers exactly the five collections", () => {
    assert.deepEqual([...TOUR_COLLECTION_KEYS].sort(), ["destinations", "guides", "hotels", "itinerary", "transport"].sort());
  });

  it("itinerary requires a title and normalizes the day", () => {
    assert.equal(TOUR_COLLECTIONS.itinerary.validate({}).valid, false);
    assert.equal(TOUR_COLLECTIONS.itinerary.validate({ title: "Arrival", dayNumber: 0 }).valid, false);
    const built = TOUR_COLLECTIONS.itinerary.build({ title: " Day 1 ", dayNumber: "1", description: "Land" }, "i1");
    assert.equal(built.id, "i1");
    assert.equal(built.title, "Day 1");
    assert.equal(built.dayNumber, 1);
    assert.equal(built.description, "Land");
  });

  it("destinations requires a name", () => {
    assert.equal(TOUR_COLLECTIONS.destinations.validate({}).valid, false);
    assert.equal(TOUR_COLLECTIONS.destinations.build({ name: " Cox's Bazar ", nights: "2" }, "d1").name, "Cox's Bazar");
    assert.equal(TOUR_COLLECTIONS.destinations.build({ name: "X", nights: "2" }, "d1").nights, 2);
  });

  it("hotels requires a hotelName, transport requires a type, guides require a name", () => {
    assert.equal(TOUR_COLLECTIONS.hotels.validate({}).valid, false);
    assert.equal(TOUR_COLLECTIONS.hotels.validate({ hotelName: "Sea Palace" }).valid, true);
    assert.equal(TOUR_COLLECTIONS.transport.validate({}).valid, false);
    assert.equal(TOUR_COLLECTIONS.transport.validate({ type: "bus" }).valid, true);
    assert.equal(TOUR_COLLECTIONS.guides.validate({}).valid, false);
    assert.equal(TOUR_COLLECTIONS.guides.validate({ name: "Rahim" }).valid, true);
  });
});

describe("tourBookingValidation — generic collection manipulators (pure, immutable)", () => {
  it("addCollectionItem returns a new array", () => {
    const original = [];
    const next = addCollectionItem(original, { id: "a" });
    assert.equal(original.length, 0);
    assert.equal(next.length, 1);
  });
  it("updateCollectionItem merges by id without mutating, preserving the id", () => {
    const list = [{ id: "a", title: "old" }];
    const next = updateCollectionItem(list, "a", { title: "new", id: "hacked" });
    assert.equal(list[0].title, "old");
    assert.equal(next[0].title, "new");
    assert.equal(next[0].id, "a");
  });
  it("removeCollectionItem filters by id without mutating", () => {
    const list = [{ id: "a" }, { id: "b" }];
    const next = removeCollectionItem(list, "a");
    assert.equal(next.length, 1);
    assert.equal(next[0].id, "b");
    assert.equal(list.length, 2);
  });
});

describe("GET/POST/PATCH/DELETE /api/tour-bookings — all routes require authentication", () => {
  const app = createApp();

  const cases = [
    ["get", "/api/tour-bookings/domain"],
    ["get", "/api/tour-bookings"],
    ["get", "/api/tour-bookings/some-id"],
    ["post", "/api/tour-bookings"],
    ["patch", "/api/tour-bookings/some-id"],
    ["delete", "/api/tour-bookings/some-id"],
    ["get", "/api/tour-bookings/some-id/travellers"],
    ["post", "/api/tour-bookings/some-id/travellers"],
    ["delete", "/api/tour-bookings/some-id/travellers/some-traveller-id"],
    ["get", "/api/tour-bookings/some-id/itinerary"],
    ["post", "/api/tour-bookings/some-id/itinerary"],
    ["patch", "/api/tour-bookings/some-id/itinerary/some-item-id"],
    ["delete", "/api/tour-bookings/some-id/itinerary/some-item-id"],
    ["get", "/api/tour-bookings/some-id/destinations"],
    ["post", "/api/tour-bookings/some-id/destinations"],
    ["get", "/api/tour-bookings/some-id/hotels"],
    ["post", "/api/tour-bookings/some-id/hotels"],
    ["get", "/api/tour-bookings/some-id/transport"],
    ["post", "/api/tour-bookings/some-id/transport"],
    ["get", "/api/tour-bookings/some-id/guides"],
    ["post", "/api/tour-bookings/some-id/guides"],
    ["get", "/api/tour-bookings/some-id/schedule"],
    ["get", "/api/tour-bookings/some-id/documents"],
    ["get", "/api/tour-bookings/some-id/timeline"],
    ["post", "/api/tour-bookings/some-id/timeline"],
    ["get", "/api/tour-bookings/some-id/notes"],
    ["post", "/api/tour-bookings/some-id/notes"],
  ];

  for (const [method, path] of cases) {
    it(`requires authentication on ${method.toUpperCase()} ${path} (401 without a token)`, async () => {
      const res = await request(app)[method](path);
      assert.equal(res.status, 401);
      assert.match(res.body.message, /token/i);
    });
  }
});
