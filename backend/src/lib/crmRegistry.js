// CRM Registry — Phase 2, CRM Foundation
// (docs/v2-master/11-Architecture-Freeze.md, docs/v2-master/12-Implementation-Sequence.md Phase 2).
//
// Metadata only — no new tables, no re-declared entity shape. "Use existing
// database models. Do not duplicate entity definitions." Every `model` named
// below is a real Prisma model in backend/prisma/schema.prisma, untouched.
//
// "Contact" and "Organization" are not literal Prisma models in this schema,
// so their mapping is documented rather than assumed:
//   - Contact: this codebase has no single "Contact" table — Client, Lead,
//     Agent, and Vendor are each their own name+phone+email-bearing entity.
//     Contact Engine is a normalizing read view across all four, not a new
//     table.
//   - Organization: the literal, already-registered concept in this codebase
//     is the tenant's OWN profile (nav item "organization", RBAC module
//     "organization" — see backend/src/lib/moduleRegistry.js). The
//     plausible alternate reading — a B2B "organization" customer, i.e.
//     Client.clientType === "corporate" — is not a separate model; it's
//     already reachable through Customer Engine by filtering on clientType,
//     so nothing is missing under either reading.

const CRM_REGISTRY = {
  customer: {
    label: "Customer",
    model: "Client",
    tenantScoped: true,
    keyFields: ["id", "name", "phone", "email", "clientType", "companyName", "walletBalance", "creditLimit", "tags", "tenantId", "createdAt"],
    relations: ["familyMembers", "walletTransactions", "documents", "bookings", "invoices", "leads", "quotations", "supportTickets", "loyaltyAccount"],
    resolvedBy: "customerEngine",
  },
  lead: {
    label: "Lead",
    model: "Lead",
    tenantScoped: true,
    keyFields: ["id", "name", "phone", "email", "status", "source", "score", "assignedTo", "nextFollowUp", "tags", "clientId", "tenantId", "createdAt"],
    relations: ["activities", "quotations"],
    resolvedBy: "leadEngine",
    statusSetId: "leadStatus", // cross-references the Status Engine (Milestone 5)
  },
  contact: {
    label: "Contact",
    model: null,
    spans: ["Client", "Lead", "Agent", "Vendor"],
    tenantScoped: true,
    resolvedBy: "contactEngine",
    note: "Normalizing view over every name+phone+email-bearing CRM entity — no dedicated Contact table exists.",
  },
  organization: {
    label: "Organization",
    model: "Tenant",
    tenantScoped: false, // it IS the tenant record itself, not a child of one
    keyFields: ["id", "name", "slug", "phone", "whatsapp", "website", "address", "city", "country", "logo", "currency", "timezone"],
    resolvedBy: "organizationEngine",
    note: "The agency's own profile. The B2B-corporate-account reading (Client.clientType === 'corporate') is already covered by Customer Engine, not a separate model.",
  },
};

function getCrmRegistry() {
  return CRM_REGISTRY;
}

function getCrmEntity(key) {
  return CRM_REGISTRY[key];
}

module.exports = { CRM_REGISTRY, getCrmRegistry, getCrmEntity };
