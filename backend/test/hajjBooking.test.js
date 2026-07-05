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
  SERVICE_TYPE_VALUE,
  PACKAGE_TYPES,
  HAJJ_FIELDS,
  resolveHajjDomain,
} = require("../src/lib/hajjDomain");
const {
  GENDERS,
  computeAge,
  validateHajjBooking,
  validatePilgrim,
  addPilgrim,
  updatePilgrim,
  removePilgrim,
  buildMahramMap,
} = require("../src/lib/hajjBookingValidation");

const VALID_PAYLOAD = { clientId: "some-client-id", packageType: "hajj" };

describe("hajjDomain — Hajj & Umrah Booking Domain", () => {
  it("supports both hajj and umrah in one module", () => {
    assert.deepEqual([...PACKAGE_TYPES].sort(), ["hajj", "umrah"]);
    assert.equal(BOOKING_TYPE_VALUE, "hajj");
    assert.equal(SERVICE_TYPE_VALUE, "hajj_umrah");
  });

  it("exposes packageType as a required field", () => {
    const pt = HAJJ_FIELDS.find((f) => f.key === "packageType");
    assert.equal(pt.required, true);
    assert.deepEqual(pt.options, ["hajj", "umrah"]);
  });

  it("composes BOTH Booking Registry contexts (hajj + umrah), not duplicating them", () => {
    const domain = resolveHajjDomain();
    assert.deepEqual(domain.bookingContext.hajj, resolveBookingContext("hajj"));
    assert.deepEqual(domain.bookingContext.umrah, resolveBookingContext("umrah"));
    // Both carry the Hajj status sets from Booking Registry.
    assert.ok(domain.bookingContext.hajj.statusFlow.additional.some((s) => s.id === "hajjPilgrimStatus"));
  });
});

describe("hajjBookingValidation — validateHajjBooking (pure)", () => {
  it("accepts a valid hajj and a valid umrah booking", () => {
    assert.deepEqual(validateHajjBooking(VALID_PAYLOAD), { valid: true, errors: [] });
    assert.deepEqual(validateHajjBooking({ ...VALID_PAYLOAD, packageType: "umrah" }), { valid: true, errors: [] });
  });

  it("requires packageType to be hajj or umrah", () => {
    assert.equal(validateHajjBooking({ ...VALID_PAYLOAD, packageType: "tour" }).valid, false);
    assert.equal(validateHajjBooking({ clientId: "c1" }).valid, false); // missing packageType
  });

  it("requires clientId or clientName", () => {
    assert.equal(validateHajjBooking({ packageType: "hajj" }).valid, false);
    assert.equal(validateHajjBooking({ packageType: "hajj", clientName: "Karim" }).valid, true);
  });

  it("requires returnDate to be after departureDate when both are given", () => {
    assert.equal(validateHajjBooking({ ...VALID_PAYLOAD, departureDate: "2026-06-01", returnDate: "2026-05-01" }).valid, false);
    assert.equal(validateHajjBooking({ ...VALID_PAYLOAD, departureDate: "2026-06-01", returnDate: "2026-06-20" }).valid, true);
  });
});

describe("hajjBookingValidation — pilgrim validation + manipulation (pure)", () => {
  it("requires a pilgrim name and validates gender/passport/dob", () => {
    assert.equal(validatePilgrim({}).valid, false);
    assert.equal(validatePilgrim({ name: "Karim", gender: "unknown" }).valid, false);
    assert.equal(validatePilgrim({ name: "Karim", passportNumber: "AB1" }).valid, false);
    assert.equal(validatePilgrim({ name: "Karim", dateOfBirth: "not-a-date" }).valid, false);
    assert.equal(validatePilgrim({ name: "Karim", gender: "male", passportNumber: "AB123456", dateOfBirth: "1980-01-01" }).valid, true);
  });

  it("exposes the gender set", () => {
    assert.deepEqual([...GENDERS].sort(), ["female", "male", "other"]);
  });

  it("addPilgrim / updatePilgrim / removePilgrim are immutable", () => {
    const original = [];
    const added = addPilgrim(original, { id: "p1", name: " Karim ", gender: "male" });
    assert.equal(original.length, 0);
    assert.equal(added[0].name, "Karim");

    const updated = updatePilgrim(added, "p1", { roomType: "double" });
    assert.equal(added[0].roomType, null, "must not mutate the original (addPilgrim normalizes roomType to null)");
    assert.equal(updated[0].roomType, "double");
    assert.equal(updated[0].id, "p1");

    const removed = removePilgrim(updated, "p1");
    assert.equal(removed.length, 0);
    assert.equal(updated.length, 1, "must not mutate");
  });
});

describe("hajjBookingValidation — computeAge (pure)", () => {
  it("computes whole years and returns null for invalid/future dates", () => {
    assert.equal(computeAge("2000-01-01", "2026-01-01"), 26);
    assert.equal(computeAge("not-a-date", "2026-01-01"), null);
    assert.equal(computeAge("2030-01-01", "2026-01-01"), null); // future dob
  });
});

describe("hajjBookingValidation — buildMahramMap (the genuine Hajj value-add)", () => {
  const asOf = "2026-01-01";
  const pilgrims = [
    { id: "p1", name: "Ahmed", gender: "male", dateOfBirth: "1980-01-01" },
    { id: "p2", name: "Fatima", gender: "female", dateOfBirth: "2000-01-01" }, // young, no mahram
    { id: "p3", name: "Ayesha", gender: "female", dateOfBirth: "2000-01-01", mahramPilgrimId: "p1" }, // resolved mahram
    { id: "p4", name: "Khadija", gender: "female", dateOfBirth: "1970-01-01" }, // old, no mahram needed
    { id: "p5", name: "Zainab", gender: "female", mahramName: "Guardian" }, // no dob, named mahram
  ];

  it("flags mahram requirement for young/unknown-age female pilgrims and resolves the relationship", () => {
    const map = buildMahramMap(pilgrims, asOf);
    const byId = Object.fromEntries(map.pilgrims.map((r) => [r.id, r]));

    assert.equal(byId.p1.mahramRequired, false); // male
    assert.equal(byId.p2.mahramRequired, true);
    assert.equal(byId.p2.compliant, false); // young female, no mahram
    assert.equal(byId.p3.compliant, true);
    assert.equal(byId.p3.mahramResolvedName, "Ahmed"); // resolved via mahramPilgrimId
    assert.equal(byId.p4.mahramRequired, false); // over the age threshold
    assert.equal(byId.p5.mahramRequired, true); // unknown age -> required
    assert.equal(byId.p5.compliant, true); // named mahram
  });

  it("summarizes compliance across the manifest", () => {
    const map = buildMahramMap(pilgrims, asOf);
    assert.equal(map.summary.total, 5);
    assert.equal(map.summary.requiringMahram, 3); // p2, p3, p5
    assert.equal(map.summary.nonCompliant, 1); // p2
    assert.deepEqual(map.missingMahram, ["p2"]);
  });

  it("handles an empty manifest", () => {
    assert.deepEqual(buildMahramMap([], asOf), {
      pilgrims: [],
      missingMahram: [],
      summary: { total: 0, requiringMahram: 0, compliant: 0, nonCompliant: 0 },
    });
  });
});

describe("GET/POST/PATCH/DELETE /api/hajj-bookings — all routes require authentication", () => {
  const app = createApp();

  const cases = [
    ["get", "/api/hajj-bookings/domain"],
    ["get", "/api/hajj-bookings"],
    ["get", "/api/hajj-bookings/some-id"],
    ["post", "/api/hajj-bookings"],
    ["patch", "/api/hajj-bookings/some-id"],
    ["delete", "/api/hajj-bookings/some-id"],
    ["get", "/api/hajj-bookings/some-id/pilgrims"],
    ["post", "/api/hajj-bookings/some-id/pilgrims"],
    ["patch", "/api/hajj-bookings/some-id/pilgrims/some-pilgrim-id"],
    ["delete", "/api/hajj-bookings/some-id/pilgrims/some-pilgrim-id"],
    ["get", "/api/hajj-bookings/some-id/mahram-map"],
    ["get", "/api/hajj-bookings/some-id/itinerary"],
    ["get", "/api/hajj-bookings/some-id/hotel-allocation"],
    ["get", "/api/hajj-bookings/some-id/flight-allocation"],
    ["get", "/api/hajj-bookings/some-id/group"],
    ["post", "/api/hajj-bookings/some-id/link-package"],
    ["post", "/api/hajj-bookings/some-id/link-group"],
    ["get", "/api/hajj-bookings/some-id/documents"],
    ["get", "/api/hajj-bookings/some-id/timeline"],
    ["post", "/api/hajj-bookings/some-id/timeline"],
    ["get", "/api/hajj-bookings/some-id/notes"],
    ["post", "/api/hajj-bookings/some-id/notes"],
  ];

  for (const [method, path] of cases) {
    it(`requires authentication on ${method.toUpperCase()} ${path} (401 without a token)`, async () => {
      const res = await request(app)[method](path);
      assert.equal(res.status, 401);
      assert.match(res.body.message, /token/i);
    });
  }
});
