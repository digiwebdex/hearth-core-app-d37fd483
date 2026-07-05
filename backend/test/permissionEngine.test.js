require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-at-least-32-characters-long";
process.env.RATE_LIMIT_DISABLED = "true";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../src/app");
const { ROLE_PERMISSIONS } = require("../src/middleware/auth");
const {
  MODULES,
  ACTIONS,
  CANONICAL_ROLE_KEYS,
  ROLE_REGISTRY,
  resolveRole,
  getPermissionSet,
  getAccessibleModules,
  hasPermission,
  resolveUserPermissionContext,
} = require("../src/lib/permissionEngine");

const NAMED_ROLE_KEYS = [
  "super_admin", "owner", "manager", "accountant", "sales_executive",
  "visa_officer", "ticket_officer", "hajj_officer", "support", "customer", "agent",
];

describe("permissionEngine — Permission Registry shape", () => {
  it("MODULES is derived from ROLE_PERMISSIONS, not hand-maintained", () => {
    const expected = [...new Set(Object.values(ROLE_PERMISSIONS).flatMap((p) => Object.keys(p)))].sort();
    assert.deepEqual(MODULES, expected);
  });

  it("ACTIONS is the 6 known actions", () => {
    assert.deepEqual([...ACTIONS].sort(), ["approve", "create", "delete", "edit", "export", "view"]);
  });

  it("CANONICAL_ROLE_KEYS includes super_admin plus every ROLE_PERMISSIONS role", () => {
    assert.deepEqual(
      [...CANONICAL_ROLE_KEYS].sort(),
      [...Object.keys(ROLE_PERMISSIONS), "super_admin"].sort(),
    );
  });

  it("registers exactly the 11 requested named roles", () => {
    assert.deepEqual(ROLE_REGISTRY.map((r) => r.key).sort(), [...NAMED_ROLE_KEYS].sort());
  });

  it("marks Visa/Ticket/Hajj Officer and Support as not-yet-implemented, inheriting operations", () => {
    for (const key of ["visa_officer", "ticket_officer", "hajj_officer", "support"]) {
      const entry = ROLE_REGISTRY.find((r) => r.key === key);
      assert.equal(entry.implemented, false, `${key} should be marked not implemented`);
      assert.equal(entry.backedBy, "operations", `${key} should inherit operations`);
    }
  });

  it("marks Super Admin/Owner/Manager/Accountant/Sales Executive as implemented, 1:1 with a canonical role", () => {
    const mapping = {
      super_admin: "super_admin",
      owner: "tenant_owner",
      manager: "manager",
      accountant: "accountant",
      sales_executive: "sales_agent",
    };
    for (const [key, backedBy] of Object.entries(mapping)) {
      const entry = ROLE_REGISTRY.find((r) => r.key === key);
      assert.equal(entry.implemented, true, `${key} should be implemented`);
      assert.equal(entry.backedBy, backedBy);
    }
  });

  it("Customer and Agent are registered as portal roles with no RBAC backing", () => {
    for (const key of ["customer", "agent"]) {
      const entry = ROLE_REGISTRY.find((r) => r.key === key);
      assert.equal(entry.category, "portal");
      assert.equal(entry.backedBy, null);
    }
  });
});

describe("permissionEngine — wraps ROLE_PERMISSIONS without duplicating it", () => {
  for (const role of ["tenant_owner", "manager", "sales_agent", "accountant", "operations"]) {
    it(`getPermissionSet("${role}") is byte-identical to ROLE_PERMISSIONS.${role}`, () => {
      assert.deepEqual(getPermissionSet(role), ROLE_PERMISSIONS[role]);
    });
  }

  it("super_admin gets every action on every registered module", () => {
    const grants = getPermissionSet("super_admin");
    for (const module of MODULES) {
      assert.deepEqual([...grants[module]].sort(), [...ACTIONS].sort(), `super_admin should have all actions on ${module}`);
    }
  });
});

describe("permissionEngine — Role Resolver", () => {
  it("resolves canonical AppRole keys directly", () => {
    assert.equal(resolveRole("tenant_owner").canonicalRole, "tenant_owner");
    assert.equal(resolveRole("manager").canonicalRole, "manager");
    assert.equal(resolveRole("sales_agent").canonicalRole, "sales_agent");
    assert.equal(resolveRole("accountant").canonicalRole, "accountant");
    assert.equal(resolveRole("operations").canonicalRole, "operations");
    assert.equal(resolveRole("super_admin").canonicalRole, "super_admin");
  });

  it("resolves legacy DB aliases exactly like src/lib/permissions.ts's mapLegacyRole", () => {
    assert.equal(resolveRole("owner").canonicalRole, "tenant_owner");
    assert.equal(resolveRole("admin").canonicalRole, "tenant_owner");
    assert.equal(resolveRole("member").canonicalRole, "sales_agent");
  });

  it("resolves named placeholder roles to their inherited canonical role, marked not implemented", () => {
    const visa = resolveRole("visa_officer");
    assert.equal(visa.canonicalRole, "operations");
    assert.equal(visa.implemented, false);
  });

  it("resolves portal roles with no canonical RBAC backing", () => {
    const customer = resolveRole("customer");
    assert.equal(customer.category, "portal");
    assert.equal(customer.canonicalRole, null);
    assert.equal(customer.portalRole, "customer");
  });

  it("falls back to sales_agent (safest default) for an unrecognized role", () => {
    const resolved = resolveRole("totally-not-a-role");
    assert.equal(resolved.canonicalRole, "sales_agent");
  });
});

describe("permissionEngine — Permission Resolver matches the documented matrix", () => {
  it("manager can approve invoices but cannot delete them", () => {
    assert.equal(hasPermission("manager", "invoices", "approve"), true);
    assert.equal(hasPermission("manager", "invoices", "delete"), false);
  });

  it("sales_agent has no accounts access at all", () => {
    assert.equal(hasPermission("sales_agent", "accounts", "view"), false);
    assert.ok(!getAccessibleModules("sales_agent").includes("accounts"));
  });

  it("operations has no leads access", () => {
    assert.equal(hasPermission("operations", "leads", "view"), false);
  });

  it("accountant can view and export reports but not create/edit/delete/approve them", () => {
    assert.equal(hasPermission("accountant", "reports", "view"), true);
    assert.equal(hasPermission("accountant", "reports", "export"), true);
    assert.equal(hasPermission("accountant", "reports", "create"), false);
    assert.equal(hasPermission("accountant", "reports", "delete"), false);
  });

  it("super_admin can do anything, including modules it has no explicit entry for", () => {
    assert.equal(hasPermission("super_admin", "settings", "delete"), true);
  });
});

describe("permissionEngine — Final Permission Context (Permission Resolver chain)", () => {
  it("composes role + permissions + module access + Plan Engine features/flags", async () => {
    const context = await resolveUserPermissionContext({
      role: "manager",
      tenantId: "test-tenant-id",
      plan: "business",
      enabledModules: ["hajj"],
      enabledServiceTypes: ["hajj_umrah"],
      enabledSubcategories: [],
    });

    assert.equal(context.role.canonicalRole, "manager");
    assert.deepEqual(context.permissions, ROLE_PERMISSIONS.manager);
    assert.ok(context.moduleAccess.includes("invoices"));
    assert.equal(context.plan.plan, "business");
    assert.deepEqual(context.plan.enabledModules, ["hajj"]);
    // No DATABASE_URL configured in this test environment -> SystemFlag reads
    // fail safe to their coded defaults (all false).
    assert.deepEqual(context.flags, {
      dynamicSidebar: false,
      planEngineV2: false,
      statusEngineV2: false,
    });
  });

  it("resolves a legacy 'owner' role through to full tenant_owner permissions", async () => {
    const context = await resolveUserPermissionContext({ role: "owner", tenantId: "test-tenant-id" });
    assert.equal(context.role.canonicalRole, "tenant_owner");
    assert.deepEqual(context.permissions, ROLE_PERMISSIONS.tenant_owner);
  });
});

describe("GET /api/permission-engine", () => {
  const app = createApp();

  it("requires authentication (401 without a token)", async () => {
    const res = await request(app).get("/api/permission-engine");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });

  it("requires authentication on /me (401 without a token)", async () => {
    const res = await request(app).get("/api/permission-engine/me");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });

  it("requires authentication on /roles/:role (401 without a token)", async () => {
    const res = await request(app).get("/api/permission-engine/roles/manager");
    assert.equal(res.status, 401);
    assert.match(res.body.message, /token/i);
  });
});
