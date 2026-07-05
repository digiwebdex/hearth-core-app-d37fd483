// Feature Flag API — Phase 1, Milestone 2
// (docs/v2-master/11-Architecture-Freeze.md §12, docs/v2-master/12-Implementation-Sequence.md Phase 1).
//
// GET is available to any authenticated user (reads their own tenant's
// effective flags — every flag defaults to OFF). Toggling a flag is
// super_admin-only, mirroring how every other cross-tenant control-plane
// action in this codebase is gated (see requireSuperAdmin usage elsewhere).
// Nothing in the app consumes these flags yet — see featureFlags.js header.

const router = require("express").Router();
const { authenticate, requireSuperAdmin } = require("../middleware/auth");
const { KNOWN_FLAGS, isKnownFlag, getAllFlags, setFlag } = require("../lib/featureFlags");

router.use(authenticate);

router.get("/", async (req, res) => {
  try {
    const values = await getAllFlags(req.tenantId);
    const flags = Object.fromEntries(
      Object.keys(KNOWN_FLAGS).map((key) => [
        key,
        { enabled: values[key], description: KNOWN_FLAGS[key].description },
      ]),
    );
    res.json({ flags });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load feature flags" });
  }
});

router.patch("/:key", requireSuperAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    if (!isKnownFlag(key)) {
      return res.status(404).json({ message: `Unknown feature flag: ${key}` });
    }
    const { enabled, tenantId } = req.body || {};
    if (typeof enabled !== "boolean") {
      return res.status(400).json({ message: "enabled (boolean) is required" });
    }
    const updated = await setFlag(key, enabled, tenantId || null);
    res.json({ key: updated.key, enabled: updated.enabled, tenantId: updated.tenantId });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update feature flag" });
  }
});

module.exports = router;
