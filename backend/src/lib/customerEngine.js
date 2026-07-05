// Customer Engine — Phase 2, CRM Foundation
// (docs/v2-master/11-Architecture-Freeze.md, docs/v2-master/12-Implementation-Sequence.md Phase 2).
//
// Read-only. Wraps the existing Client model and its relations exactly as
// they exist today — no new fields, no schema change, no write path. This
// is a composed READ (a "Customer 360" view), not a replacement for the
// existing /api/clients routes (backend/src/routes/clients.js), which keep
// working unchanged.
//
// passportNumber/passportExpiry/nationality were added to the select below
// (Visa Booking Module) — real, pre-existing Client columns that just
// weren't selected yet; not a schema change, and every existing consumer of
// resolveCustomerContext() only gets additional fields, never fewer.
//
// Real read failures (a down/unmigrated database) are NOT masked here —
// unlike Feature Flags (Milestone 2), there is no sensible "safe default"
// for "what is this customer's data", so this throws like every other
// Prisma-backed route in the app. Only clearly-invalid input (no id) short-
// circuits before touching the database.

const { prisma } = require("../middleware/auth");

/** Resolve one customer's composed context: core fields + related record counts. Returns null if not found in this tenant. */
async function resolveCustomerContext(clientId, tenantId) {
  if (!clientId || !tenantId) return null;

  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId },
    select: {
      id: true, name: true, phone: true, email: true, clientType: true, companyName: true,
      walletBalance: true, creditLimit: true, tags: true, createdAt: true, updatedAt: true,
      passportNumber: true, passportExpiry: true, nationality: true,
    },
  });
  if (!client) return null;

  const [bookings, invoices, leads, quotations, familyMembers, documents] = await Promise.all([
    prisma.booking.count({ where: { clientId } }),
    prisma.invoice.count({ where: { clientId } }),
    prisma.lead.count({ where: { clientId } }),
    prisma.quotation.count({ where: { clientId } }),
    prisma.clientFamilyMember.count({ where: { clientId } }),
    prisma.clientDocument.count({ where: { clientId } }),
  ]);

  return {
    ...client,
    counts: { bookings, invoices, leads, quotations, familyMembers, documents },
  };
}

module.exports = { resolveCustomerContext };
