// Tenant provisioning helpers — shared by registration (routes/auth.js) and the
// seed script so the "every tenant has a primary branch" invariant holds for real
// signups, not just seeded demos (docs/v2-master/111-SaaS-Plan-System.md).

/**
 * Ensure a tenant has a primary "Head Office" branch and every unassigned user
 * belongs to it. Idempotent. `client` is a PrismaClient (the app's shared client
 * or the seed's own instance).
 */
async function ensurePrimaryBranch(client, tenantId, name = "Head Office") {
  let branch = await client.branch.findFirst({ where: { tenantId, isPrimary: true } });
  if (!branch) branch = await client.branch.findFirst({ where: { tenantId } });
  if (!branch) {
    branch = await client.branch.create({
      data: { tenantId, name, code: "HO", isPrimary: true, isActive: true },
    });
  }
  await client.user.updateMany({ where: { tenantId, branchId: null }, data: { branchId: branch.id } });
  return branch;
}

/**
 * Derive the legacy operations-desk module flags from the tenant's chosen service
 * types (capability model: "enable only what you offer"). When no service types
 * are specified the tenant is in "show everything" mode, so Hajj/Umrah stays on.
 */
function deriveModuleFlags(serviceTypes = []) {
  const set = new Set((Array.isArray(serviceTypes) ? serviceTypes : []).map((s) => String(s).trim().toLowerCase()).filter(Boolean));
  const showEverything = set.size === 0;
  return {
    enableHajjUmrahModule: showEverything || set.has("hajj_umrah"),
    enableBdOperationsModule: set.has("study_abroad") || set.has("b2b_agent"),
  };
}

module.exports = { ensurePrimaryBranch, deriveModuleFlags };
