require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-at-least-32-characters-long";
process.env.RATE_LIMIT_DISABLED = "true";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../src/app");
const crmActivities = require("../src/routes/crmActivities");
const tasks = require("../src/routes/tasks");

describe("crmActivities — registry shape", () => {
  it("exposes the entity types a note/activity can attach to", () => {
    assert.deepEqual(
      crmActivities.ENTITY_TYPES.slice().sort(),
      ["agent", "client", "corporate", "lead", "vendor"].sort(),
    );
  });

  it("treats a note as an activity of type 'note' (unified store)", () => {
    assert.ok(crmActivities.ACTIVITY_TYPES.includes("note"));
    assert.ok(crmActivities.ACTIVITY_TYPES.includes("call"));
    assert.ok(crmActivities.ACTIVITY_TYPES.includes("whatsapp"));
  });
});

describe("tasks — CRM linkage registry", () => {
  it("lists the record types a task can be linked to", () => {
    assert.ok(tasks.RELATED_TYPES.includes("client"));
    assert.ok(tasks.RELATED_TYPES.includes("booking"));
    assert.ok(tasks.RELATED_TYPES.includes("lead"));
  });
});

describe("GET/POST /api/crm-activities — auth gate", () => {
  const app = createApp();

  it("requires authentication on list (401 without a token)", async () => {
    const res = await request(app).get("/api/crm-activities?entityType=client&entityId=x");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });

  it("requires authentication on /due (401 without a token)", async () => {
    const res = await request(app).get("/api/crm-activities/due");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });

  it("requires authentication on create (401 without a token)", async () => {
    const res = await request(app)
      .post("/api/crm-activities")
      .send({ entityType: "client", entityId: "x", body: "hi" });
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });
});

describe("GET/POST /api/tasks — auth gate (enriched route still mounted)", () => {
  const app = createApp();

  it("requires authentication on list (401 without a token)", async () => {
    const res = await request(app).get("/api/tasks");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });

  it("requires authentication on create (401 without a token)", async () => {
    const res = await request(app).post("/api/tasks").send({ title: "T" });
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });
});
