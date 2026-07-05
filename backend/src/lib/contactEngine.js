// Contact Engine — Phase 2, CRM Foundation
// (docs/v2-master/11-Architecture-Freeze.md, docs/v2-master/12-Implementation-Sequence.md Phase 2).
//
// Read-only. There is no single "Contact" table in this schema — Client,
// Lead, Agent, and Vendor are each their own name+phone+email-bearing
// entity (see crmRegistry.js). This engine normalizes a lookup across all
// four into one shape, without duplicating any of their own field
// definitions or introducing a new model.

const { prisma } = require("../middleware/auth");

const CONTACT_TYPES = ["client", "lead", "agent", "vendor"];

const FETCHERS = {
  client: (id, tenantId) => prisma.client.findFirst({ where: { id, tenantId }, select: { id: true, name: true, phone: true, email: true } }),
  lead: (id, tenantId) => prisma.lead.findFirst({ where: { id, tenantId }, select: { id: true, name: true, phone: true, email: true } }),
  agent: (id, tenantId) => prisma.agent.findFirst({ where: { id, tenantId }, select: { id: true, name: true, phone: true, email: true } }),
  vendor: (id, tenantId) => prisma.vendor.findFirst({ where: { id, tenantId }, select: { id: true, name: true, phone: true, email: true } }),
};

/**
 * Resolve one contact by type + id, normalized to { id, type, name, phone,
 * email, tenantId } regardless of its underlying model. Returns null for an
 * unknown type (before touching the database) or a record that doesn't
 * exist in this tenant.
 */
async function resolveContactContext(type, id, tenantId) {
  const fetcher = FETCHERS[type];
  if (!fetcher || !id || !tenantId) return null;

  const record = await fetcher(id, tenantId);
  if (!record) return null;

  return { id: record.id, type, name: record.name, phone: record.phone ?? null, email: record.email ?? null, tenantId };
}

module.exports = { CONTACT_TYPES, resolveContactContext };
