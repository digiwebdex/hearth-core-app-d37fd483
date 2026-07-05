// Status API — Phase 1, Milestone 5
// (docs/v2-master/11-Architecture-Freeze.md §10, docs/v2-master/12-Implementation-Sequence.md Phase 1).
//
// Read-only. Nothing here validates or modifies a status — every existing
// write route keeps persisting status values exactly as it does today.
// Route order matters: /categories must be declared before the generic
// /:statusSetId, and /:statusSetId/resolve/:value before nothing else
// conflicts with it since it's nested under a fixed segment.

const router = require("express").Router();
const { authenticate } = require("../middleware/auth");
const {
  getStatusRegistry,
  getStatusSet,
  getCategories,
  getStatusSetsForCategory,
  resolveStatus,
} = require("../lib/statusEngine");

router.use(authenticate);

/** The full Status Registry — every status set, its values, labels, and colors. */
router.get("/", (_req, res) => {
  res.json({ statusSets: getStatusRegistry() });
});

/** The 13+ named categories (Booking Status, Payment Status, ... Agent Status). */
router.get("/categories", (_req, res) => {
  res.json({ categories: getCategories() });
});

/** Every status set backing one named category (some categories span more than one entity). */
router.get("/categories/:category", (req, res) => {
  const statusSetIds = getStatusSetsForCategory(req.params.category);
  res.json({
    category: req.params.category,
    statusSets: statusSetIds.map((id) => ({ id, ...getStatusSet(id) })),
  });
});

/** One status set's full definition (values + labels + colors). */
router.get("/:statusSetId", (req, res) => {
  const set = getStatusSet(req.params.statusSetId);
  if (!set) return res.status(404).json({ message: `Unknown status set: ${req.params.statusSetId}` });
  res.json({ id: req.params.statusSetId, ...set });
});

/** The Final Status Context for one current value within a status set. */
router.get("/:statusSetId/resolve/:value", (req, res) => {
  const context = resolveStatus(req.params.statusSetId, req.params.value);
  if (!context) return res.status(404).json({ message: `Unknown status set: ${req.params.statusSetId}` });
  res.json(context);
});

module.exports = router;
