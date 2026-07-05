// Lead Engine — Phase 2, CRM Foundation
// (docs/v2-master/11-Architecture-Freeze.md, docs/v2-master/12-Implementation-Sequence.md Phase 2).
//
// Read-only. Wraps the existing Lead model exactly as it exists today — no
// new fields, no write path. Composes the Status Engine (Milestone 5) for
// the lead's status label/color/stage/next-statuses instead of re-deriving
// that a second time. Does not replace /api/leads (backend/src/routes/leads.js),
// which keeps working unchanged.

const { prisma } = require("../middleware/auth");
const { resolveStatus } = require("./statusEngine");

/** Resolve one lead's composed context: core fields + Status Engine context + related counts. Returns null if not found in this tenant. */
async function resolveLeadContext(leadId, tenantId) {
  if (!leadId || !tenantId) return null;

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, tenantId },
    select: {
      id: true, name: true, phone: true, email: true, status: true, source: true, score: true,
      assignedTo: true, nextFollowUp: true, tags: true, clientId: true, createdAt: true, updatedAt: true,
    },
  });
  if (!lead) return null;

  const [activities, quotations] = await Promise.all([
    prisma.leadActivity.count({ where: { leadId } }),
    prisma.quotation.count({ where: { leadId } }),
  ]);

  return {
    ...lead,
    statusContext: resolveStatus("leadStatus", lead.status),
    convertedToClient: Boolean(lead.clientId),
    counts: { activities, quotations },
  };
}

module.exports = { resolveLeadContext };
