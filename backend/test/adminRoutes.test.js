require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-at-least-32-characters-long";
process.env.RATE_LIMIT_DISABLED = "true";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../src/app");

describe("admin legacy domain routes", () => {
  const app = createApp();

  it("exposes legacy GET /api/domains for super admin auth", async () => {
    const res = await request(app).get("/api/domains");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });

  it("exposes GET /api/admin/domains for super admin auth", async () => {
    const res = await request(app).get("/api/admin/domains");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });
});
