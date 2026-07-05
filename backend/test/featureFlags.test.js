require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-at-least-32-characters-long";
process.env.RATE_LIMIT_DISABLED = "true";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../src/app");
const {
  KNOWN_FLAGS,
  isKnownFlag,
  isEnabled,
  getAllFlags,
  setFlag,
} = require("../src/lib/featureFlags");

const EXPECTED_FLAG_KEYS = ["dynamicSidebar", "planEngineV2", "statusEngineV2"];

describe("featureFlags — registry shape", () => {
  it("registers exactly the Phase 1 flags, all defaulting to OFF", () => {
    assert.deepEqual(Object.keys(KNOWN_FLAGS).sort(), [...EXPECTED_FLAG_KEYS].sort());
    for (const key of EXPECTED_FLAG_KEYS) {
      assert.equal(KNOWN_FLAGS[key].default, false, `${key} must default to OFF`);
      assert.equal(typeof KNOWN_FLAGS[key].description, "string");
    }
  });

  it("isKnownFlag recognizes registered keys and rejects unknown ones", () => {
    for (const key of EXPECTED_FLAG_KEYS) assert.equal(isKnownFlag(key), true);
    assert.equal(isKnownFlag("somethingNotRegistered"), false);
  });
});

describe("featureFlags — reads never throw and default to OFF", () => {
  it("isEnabled resolves false for every known flag when the table is unmigrated/unreachable", async () => {
    for (const key of EXPECTED_FLAG_KEYS) {
      const value = await isEnabled(key, "any-tenant-id");
      assert.equal(value, false, `${key} should resolve to false, not throw`);
    }
  });

  it("isEnabled resolves false immediately for an unknown key, without needing a tenant", async () => {
    assert.equal(await isEnabled("notARealFlag"), false);
  });

  it("getAllFlags returns exactly the known keys, all false", async () => {
    const flags = await getAllFlags("any-tenant-id");
    assert.deepEqual(Object.keys(flags).sort(), [...EXPECTED_FLAG_KEYS].sort());
    for (const key of EXPECTED_FLAG_KEYS) assert.equal(flags[key], false);
  });
});

describe("featureFlags — writes fail loud, never silently succeed", () => {
  it("setFlag rejects an unknown key without attempting a write", async () => {
    await assert.rejects(() => setFlag("notARealFlag", true), /Unknown feature flag/);
  });

  it("setFlag rejects a non-boolean enabled value without attempting a write", async () => {
    await assert.rejects(() => setFlag("dynamicSidebar", "yes"), /enabled must be a boolean/);
  });

  it("setFlag on a known key propagates the error rather than pretending success", async () => {
    // No DATABASE_URL is configured in this test environment, so the write
    // cannot actually persist — it must reject, not resolve, in that case.
    await assert.rejects(() => setFlag("dynamicSidebar", true));
  });
});

describe("GET /api/feature-flags", () => {
  const app = createApp();

  it("requires authentication (401 without a token)", async () => {
    const res = await request(app).get("/api/feature-flags");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });
});

describe("PATCH /api/feature-flags/:key", () => {
  const app = createApp();

  it("requires authentication (401 without a token)", async () => {
    const res = await request(app).patch("/api/feature-flags/dynamicSidebar").send({ enabled: true });
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });
});
