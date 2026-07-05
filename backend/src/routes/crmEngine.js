// CRM API — Phase 2, CRM Foundation
// (docs/v2-master/11-Architecture-Freeze.md, docs/v2-master/12-Implementation-Sequence.md Phase 2).
//
// Read-only. No write operations. Mounted under /api/crm-engine — distinct
// from the existing /api/clients, /api/leads, /api/crm-analytics,
// /api/crm-settings, /api/tenants routes, which are all untouched and keep
// working exactly as before.

const router = require("express").Router();
const { authenticate } = require("../middleware/auth");
const { getCrmRegistry } = require("../lib/crmRegistry");
const { resolveCustomerContext } = require("../lib/customerEngine");
const { resolveLeadContext } = require("../lib/leadEngine");
const { resolveContactContext } = require("../lib/contactEngine");
const { resolveOrganizationContext } = require("../lib/organizationEngine");

router.use(authenticate);

/** The CRM Registry — which CRM entities exist, their backing model, and which engine resolves them. */
router.get("/registry", (_req, res) => {
  res.json({ entities: getCrmRegistry() });
});

/** Customer Engine: one client's composed context. */
router.get("/customer/:id", async (req, res) => {
  try {
    const context = await resolveCustomerContext(req.params.id, req.tenantId);
    if (!context) return res.status(404).json({ message: "Customer not found" });
    res.json(context);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to resolve customer context" });
  }
});

/** Lead Engine: one lead's composed context, including its Status Engine context. */
router.get("/lead/:id", async (req, res) => {
  try {
    const context = await resolveLeadContext(req.params.id, req.tenantId);
    if (!context) return res.status(404).json({ message: "Lead not found" });
    res.json(context);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to resolve lead context" });
  }
});

/** Contact Engine: one contact, normalized across client/lead/agent/vendor. */
router.get("/contact/:type/:id", async (req, res) => {
  try {
    const context = await resolveContactContext(req.params.type, req.params.id, req.tenantId);
    if (!context) return res.status(404).json({ message: "Contact not found" });
    res.json(context);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to resolve contact context" });
  }
});

/** Organization Engine: the caller's own tenant organizational context. */
router.get("/organization", async (req, res) => {
  try {
    const context = await resolveOrganizationContext(req.tenantId);
    if (!context) return res.status(404).json({ message: "Organization not found" });
    res.json(context);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to resolve organization context" });
  }
});

module.exports = router;
