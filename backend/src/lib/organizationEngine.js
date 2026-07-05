// Organization Engine — Phase 2, CRM Foundation
// (docs/v2-master/11-Architecture-Freeze.md, docs/v2-master/12-Implementation-Sequence.md Phase 2).
//
// Read-only. Wraps the existing Tenant model's own organizational profile
// fields exactly as they exist today — the agency's own name/contact/
// branding info, not a per-record child of the tenant. Does not replace
// /api/tenants (backend/src/routes/tenants.js), which keeps working
// unchanged. See crmRegistry.js for why "Organization" maps to Tenant here
// rather than a corporate-client reading.

const { prisma } = require("../middleware/auth");

/** Resolve the tenant's own organizational context + a few CRM headcounts. Returns null if the tenant doesn't exist. */
async function resolveOrganizationContext(tenantId) {
  if (!tenantId) return null;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true, name: true, slug: true, phone: true, whatsapp: true, website: true,
      address: true, city: true, country: true, logo: true, currency: true, timezone: true,
    },
  });
  if (!tenant) return null;

  const [users, clients, agents, vendors] = await Promise.all([
    prisma.user.count({ where: { tenantId } }),
    prisma.client.count({ where: { tenantId } }),
    prisma.agent.count({ where: { tenantId } }),
    prisma.vendor.count({ where: { tenantId } }),
  ]);

  return {
    ...tenant,
    counts: { users, clients, agents, vendors },
  };
}

module.exports = { resolveOrganizationContext };
