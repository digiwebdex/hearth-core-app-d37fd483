// Module Registry read endpoint — Phase 1, Milestone 1
// (docs/v2-master/11-Architecture-Freeze.md §6, docs/v2-master/12-Implementation-Sequence.md Phase 1).
//
// Additive, read-only. Returns the same static structure to every authenticated
// user (the registry is not tenant-specific) — filtering by role/plan/service
// type happens client-side today (unchanged) and, in later milestones, via the
// Permission Engine / Plan Engine. Nothing depends on this route yet.

const router = require("express").Router();
const { authenticate } = require("../middleware/auth");
const { getModuleRegistryGroups } = require("../lib/moduleRegistry");

router.use(authenticate);

router.get("/", (_req, res) => {
  res.json({ groups: getModuleRegistryGroups() });
});

module.exports = router;
