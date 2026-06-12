require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-at-least-32-characters-long";
process.env.RATE_LIMIT_DISABLED = "true";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../src/app");
const { validatePassword } = require("../src/utils/passwordPolicy");

describe("passwordPolicy", () => {
  it("rejects short passwords", () => {
    const result = validatePassword("abc1");
    assert.equal(result.ok, false);
  });

  it("accepts strong passwords", () => {
    const result = validatePassword("SecurePass99");
    assert.equal(result.ok, true);
  });
});

describe("auth API", () => {
  const app = createApp();

  it("returns 401 for invalid login", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "wrong-password-xyz" });
    assert.equal(res.status, 401);
    assert.match(res.body.message, /invalid credentials/i);
  });

  it("returns 400 for weak register password", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Test User",
        email: `test-${Date.now()}@example.com`,
        phone: "01712345678",
        password: "weak",
        tenantName: "Test Agency",
      });
    assert.equal(res.status, 400);
    assert.ok(res.body.message);
  });

  it("returns 400 when phone is missing on register", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Test User",
        email: `test-${Date.now()}@example.com",
        password: "SecurePass99",
        tenantName: "Test Agency",
      });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /phone/i);
  });

  it("returns 400 when email is missing on register", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Test User",
        phone: "01712345678",
        password: "SecurePass99",
        tenantName: "Test Agency",
      });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /email/i);
  });
});

describe("auth rate limit", () => {
  it("returns 429 after too many login attempts", async () => {
    process.env.RATE_LIMIT_DISABLED = "false";
    process.env.AUTH_RATE_LIMIT_MAX = "2";
    delete require.cache[require.resolve("../src/middleware/rateLimit")];
    delete require.cache[require.resolve("../src/app")];
    const { createApp: createFreshApp } = require("../src/app");
    const app = createFreshApp();

    const payload = { email: "rate-limit@example.com", password: "wrong" };
    await request(app).post("/api/auth/login").send(payload);
    await request(app).post("/api/auth/login").send(payload);
    const res = await request(app).post("/api/auth/login").send(payload);
    assert.equal(res.status, 429);

    process.env.RATE_LIMIT_DISABLED = "true";
    delete require.cache[require.resolve("../src/middleware/rateLimit")];
    delete require.cache[require.resolve("../src/app")];
  });
});
