require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-at-least-32-characters-long";
process.env.RATE_LIMIT_DISABLED = "true";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../src/app");
const { CRM_REGISTRY, getCrmRegistry, getCrmEntity } = require("../src/lib/crmRegistry");
const { resolveCustomerContext } = require("../src/lib/customerEngine");
const { resolveLeadContext } = require("../src/lib/leadEngine");
const { CONTACT_TYPES, resolveContactContext } = require("../src/lib/contactEngine");
const { resolveOrganizationContext } = require("../src/lib/organizationEngine");

describe("crmRegistry — shape", () => {
  it("registers exactly the 4 CRM entities", () => {
    assert.deepEqual(Object.keys(getCrmRegistry()).sort(), ["contact", "customer", "lead", "organization"].sort());
  });

  it("customer entity wraps the real Client model, not a new one", () => {
    const entity = getCrmEntity("customer");
    assert.equal(entity.model, "Client");
    assert.equal(entity.resolvedBy, "customerEngine");
  });

  it("lead entity cross-references the Status Engine's leadStatus set", () => {
    assert.equal(getCrmEntity("lead").statusSetId, "leadStatus");
  });

  it("contact entity spans multiple models and has no single backing table", () => {
    const entity = getCrmEntity("contact");
    assert.equal(entity.model, null);
    assert.deepEqual(entity.spans.sort(), ["Agent", "Client", "Lead", "Vendor"].sort());
  });

  it("organization entity wraps Tenant, not a child-of-tenant model", () => {
    const entity = getCrmEntity("organization");
    assert.equal(entity.model, "Tenant");
    assert.equal(entity.tenantScoped, false);
  });

  it("every entity documents which engine resolves it", () => {
    for (const [key, entity] of Object.entries(CRM_REGISTRY)) {
      assert.equal(typeof entity.resolvedBy, "string", `${key} must name its resolving engine`);
    }
  });
});

describe("customerEngine — fails safe on bad input, fails loud on real reads", () => {
  it("returns null immediately for a missing clientId or tenantId (no database touched)", async () => {
    assert.equal(await resolveCustomerContext(null, "t1"), null);
    assert.equal(await resolveCustomerContext("c1", null), null);
  });

  it("propagates a real read failure rather than returning fabricated data (no DATABASE_URL in this test environment)", async () => {
    await assert.rejects(() => resolveCustomerContext("some-client-id", "some-tenant-id"));
  });
});

describe("leadEngine — fails safe on bad input, fails loud on real reads", () => {
  it("returns null immediately for a missing leadId or tenantId (no database touched)", async () => {
    assert.equal(await resolveLeadContext(null, "t1"), null);
    assert.equal(await resolveLeadContext("l1", null), null);
  });

  it("propagates a real read failure rather than returning fabricated data", async () => {
    await assert.rejects(() => resolveLeadContext("some-lead-id", "some-tenant-id"));
  });
});

describe("contactEngine — normalizes across client/lead/agent/vendor", () => {
  it("registers exactly the 4 contact types", () => {
    assert.deepEqual([...CONTACT_TYPES].sort(), ["agent", "client", "lead", "vendor"].sort());
  });

  it("returns null immediately for an unknown contact type (no database touched)", async () => {
    assert.equal(await resolveContactContext("not-a-real-type", "id1", "t1"), null);
  });

  it("returns null immediately for a missing id or tenantId", async () => {
    assert.equal(await resolveContactContext("client", null, "t1"), null);
    assert.equal(await resolveContactContext("client", "id1", null), null);
  });

  it("propagates a real read failure for a known type rather than returning fabricated data", async () => {
    await assert.rejects(() => resolveContactContext("client", "some-id", "some-tenant-id"));
  });
});

describe("organizationEngine — fails safe on bad input, fails loud on real reads", () => {
  it("returns null immediately for a missing tenantId (no database touched)", async () => {
    assert.equal(await resolveOrganizationContext(null), null);
  });

  it("propagates a real read failure rather than returning fabricated data", async () => {
    await assert.rejects(() => resolveOrganizationContext("some-tenant-id"));
  });
});

describe("GET /api/crm-engine", () => {
  const app = createApp();

  it("requires authentication on /registry (401 without a token)", async () => {
    const res = await request(app).get("/api/crm-engine/registry");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });

  it("requires authentication on /customer/:id (401 without a token)", async () => {
    const res = await request(app).get("/api/crm-engine/customer/some-id");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });

  it("requires authentication on /lead/:id (401 without a token)", async () => {
    const res = await request(app).get("/api/crm-engine/lead/some-id");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });

  it("requires authentication on /contact/:type/:id (401 without a token)", async () => {
    const res = await request(app).get("/api/crm-engine/contact/client/some-id");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });

  it("requires authentication on /organization (401 without a token)", async () => {
    const res = await request(app).get("/api/crm-engine/organization");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });
});
