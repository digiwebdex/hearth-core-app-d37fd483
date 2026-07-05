require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-at-least-32-characters-long";
process.env.RATE_LIMIT_DISABLED = "true";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../src/app");
const { resolveStatus, getStatusSet } = require("../src/lib/statusEngine");
const {
  ENTITY_TYPES,
  ENTITY_TYPE_KEYS,
  BOOKING_ENTITY_KEYS,
  BOOKING_TYPE_IDS,
  DOCUMENT_CATEGORIES,
  isSupportedEntityType,
  getEntityRbacModule,
  isKnownCategory,
  getDocumentRegistry,
  validateDocumentInput,
  nextVersionNumber,
  buildVersionEntry,
  appendHistory,
  buildShareEntry,
  revokeShare,
  isExpired,
  isExpiringWithin,
} = require("../src/lib/documentRegistry");

describe("documentRegistry — entity types", () => {
  it("supports exactly the 9 modules from the brief", () => {
    assert.deepEqual(
      [...ENTITY_TYPE_KEYS].sort(),
      ["air_ticket", "visa", "hotel", "tour", "hajj", "customer", "supplier", "invoice", "employee"].sort(),
    );
  });

  it("every booking-sourced entity is a real Booking Registry type (no drift)", () => {
    for (const key of BOOKING_ENTITY_KEYS) {
      assert.ok(BOOKING_TYPE_IDS.includes(key), `${key} must be a real Booking Registry type`);
    }
  });

  it("maps each entity to an existing RBAC module so the Permission Engine governs access", () => {
    assert.equal(getEntityRbacModule("air_ticket"), "bookings");
    assert.equal(getEntityRbacModule("hajj"), "hajj_umrah");
    assert.equal(getEntityRbacModule("customer"), "clients");
    assert.equal(getEntityRbacModule("supplier"), "vendors");
    assert.equal(getEntityRbacModule("invoice"), "invoices");
    assert.equal(getEntityRbacModule("employee"), "team");
    assert.equal(getEntityRbacModule("not-a-real-entity"), null);
  });

  it("isSupportedEntityType recognizes the 9 and rejects unknowns", () => {
    for (const key of ENTITY_TYPE_KEYS) assert.equal(isSupportedEntityType(key), true);
    assert.equal(isSupportedEntityType("spaceship"), false);
  });

  it("getDocumentRegistry exposes entity types, categories, and the verification set id", () => {
    const reg = getDocumentRegistry();
    assert.equal(reg.entityTypes.length, 9);
    assert.equal(reg.categories.length, DOCUMENT_CATEGORIES.length);
    assert.equal(reg.verificationStatusSetId, "documentVerificationStatus");
  });
});

describe("documentRegistry — categories", () => {
  it("recognizes known categories and rejects unknown ones", () => {
    assert.equal(isKnownCategory("passport"), true);
    assert.equal(isKnownCategory("other"), true);
    assert.equal(isKnownCategory("made-up"), false);
  });
});

describe("documentRegistry — validateDocumentInput (pure, no database)", () => {
  const VALID = { title: "Passport scan", category: "passport", entityType: "visa", entityId: "booking-1", expiryDate: "2030-01-01", tags: ["urgent"] };

  it("accepts a fully valid create payload", () => {
    assert.deepEqual(validateDocumentInput(VALID), { valid: true, errors: [] });
  });

  it("requires a title", () => {
    assert.equal(validateDocumentInput({ ...VALID, title: "" }).valid, false);
  });

  it("rejects an unknown category", () => {
    assert.equal(validateDocumentInput({ ...VALID, category: "nope" }).valid, false);
  });

  it("requires a supported entityType and an entityId when requireEntity is on", () => {
    assert.equal(validateDocumentInput({ ...VALID, entityType: "spaceship" }).valid, false);
    assert.equal(validateDocumentInput({ ...VALID, entityId: "" }).valid, false);
  });

  it("skips entity checks when requireEntity is off (metadata update)", () => {
    assert.equal(validateDocumentInput({ title: "New title", category: "photo" }, { requireEntity: false }).valid, true);
  });

  it("rejects an invalid expiryDate but allows it to be omitted", () => {
    assert.equal(validateDocumentInput({ ...VALID, expiryDate: "not-a-date" }).valid, false);
    const { expiryDate, ...noExpiry } = VALID;
    assert.equal(validateDocumentInput(noExpiry).valid, true);
  });

  it("rejects non-array tags", () => {
    assert.equal(validateDocumentInput({ ...VALID, tags: "urgent" }).valid, false);
  });
});

describe("documentRegistry — version/history/share manipulators (pure, no database)", () => {
  it("nextVersionNumber increments currentVersion, defaulting a fresh doc to 1", () => {
    assert.equal(nextVersionNumber({ currentVersion: 3 }), 4);
    assert.equal(nextVersionNumber({}), 1);
    assert.equal(nextVersionNumber(null), 1);
  });

  it("buildVersionEntry captures the file metadata for a version", () => {
    const entry = buildVersionEntry({ versionNumber: 2, fileName: "p.pdf", url: "/uploads/x", mimeType: "application/pdf", size: 1234, uploadedBy: "u1", uploadedAt: "2026-01-01T00:00:00Z" });
    assert.equal(entry.versionNumber, 2);
    assert.equal(entry.fileName, "p.pdf");
    assert.equal(entry.size, 1234);
    assert.equal(entry.uploadedAt, "2026-01-01T00:00:00Z");
  });

  it("appendHistory returns a NEW array (immutable) with the entry added", () => {
    const original = [{ action: "created", at: "t0" }];
    const next = appendHistory(original, { action: "updated", actorId: "u1", detail: "x", at: "t1" });
    assert.equal(original.length, 1, "original must not be mutated");
    assert.equal(next.length, 2);
    assert.equal(next[1].action, "updated");
    assert.equal(next[1].actorId, "u1");
  });

  it("appendHistory tolerates a non-array starting value", () => {
    assert.deepEqual(appendHistory(undefined, { action: "created", at: "t0" }), [{ action: "created", actorId: null, detail: null, at: "t0" }]);
  });

  it("buildShareEntry + revokeShare add and remove a share by id", () => {
    const share = buildShareEntry({ id: "s1", sharedWith: "a@b.com", note: "review", expiresAt: null, createdBy: "u1", createdAt: "t0" });
    assert.equal(share.id, "s1");
    assert.equal(share.sharedWith, "a@b.com");
    const shares = [share, buildShareEntry({ id: "s2", sharedWith: "c@d.com", createdAt: "t1" })];
    const after = revokeShare(shares, "s1");
    assert.equal(after.length, 1);
    assert.equal(after[0].id, "s2");
  });
});

describe("documentRegistry — expiry helpers (pure, no database)", () => {
  const asOf = "2026-01-01T00:00:00Z";
  it("isExpired is true only for a date on/before asOf", () => {
    assert.equal(isExpired("2025-12-01", asOf), true);
    assert.equal(isExpired("2026-06-01", asOf), false);
    assert.equal(isExpired(null, asOf), false);
    assert.equal(isExpired("not-a-date", asOf), false);
  });

  it("isExpiringWithin is true only for a future date inside the window", () => {
    assert.equal(isExpiringWithin("2026-01-15", asOf, 30), true);
    assert.equal(isExpiringWithin("2026-03-01", asOf, 30), false); // beyond 30 days
    assert.equal(isExpiringWithin("2025-12-01", asOf, 30), false); // already past
    assert.equal(isExpiringWithin(null, asOf, 30), false);
  });
});

describe("statusEngine — documentVerificationStatus (Status Engine reuse)", () => {
  it("registers the document verification set with the three statuses", () => {
    const set = getStatusSet("documentVerificationStatus");
    assert.ok(set, "documentVerificationStatus should be registered in the Status Engine");
    assert.deepEqual(set.values.map((v) => v.value), ["unverified", "verified", "rejected"]);
  });

  it("resolveStatus returns a full context for a document verification status", () => {
    const ctx = resolveStatus("documentVerificationStatus", "verified");
    assert.equal(ctx.known, true);
    assert.equal(ctx.label, "Verified");
    assert.equal(ctx.stage, "terminal_positive");
  });
});

describe("GET/POST/PATCH/DELETE /api/document-engine — all routes require authentication", () => {
  const app = createApp();

  const cases = [
    ["get", "/api/document-engine/registry"],
    ["get", "/api/document-engine/expiring"],
    ["get", "/api/document-engine/doc/some-doc-id"],
    ["patch", "/api/document-engine/doc/some-doc-id"],
    ["delete", "/api/document-engine/doc/some-doc-id"],
    ["post", "/api/document-engine/doc/some-doc-id/versions"],
    ["post", "/api/document-engine/doc/some-doc-id/verify"],
    ["get", "/api/document-engine/doc/some-doc-id/history"],
    ["post", "/api/document-engine/doc/some-doc-id/shares"],
    ["delete", "/api/document-engine/doc/some-doc-id/shares/some-share-id"],
    ["get", "/api/document-engine/customer/some-entity-id"],
    ["post", "/api/document-engine/customer/some-entity-id"],
  ];

  for (const [method, path] of cases) {
    it(`requires authentication on ${method.toUpperCase()} ${path} (401 without a token)`, async () => {
      const res = await request(app)[method](path);
      assert.equal(res.status, 401);
      assert.match(res.body.message, /token/i);
    });
  }
});
