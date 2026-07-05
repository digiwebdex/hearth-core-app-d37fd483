// Booking Registry API — shared booking metadata layer
// (docs/v2-master/11-Architecture-Freeze.md §5, docs/v2-master/12-Implementation-Sequence.md Phase 3).
//
// Read-only. No write operations, no booking creation, no booking
// operations of any kind — this API only exposes booking TYPE metadata.
// Existing /api/bookings and every per-service route (visa, hajj,
// inventory, group-tours, ...) are untouched.

const router = require("express").Router();
const { authenticate } = require("../middleware/auth");
const {
  getBookingRegistry,
  resolveServiceType,
  resolveBookingContext,
} = require("../lib/bookingRegistry");

router.use(authenticate);

/** The full Booking Type Registry — every supported booking type and its static metadata. */
router.get("/", (_req, res) => {
  res.json({ bookingTypes: getBookingRegistry() });
});

/** Service Type Resolver: one booking type's underlying service type(s). */
router.get("/:bookingTypeId/service-type", (req, res) => {
  const context = resolveServiceType(req.params.bookingTypeId);
  if (!context) return res.status(404).json({ message: `Unknown booking type: ${req.params.bookingTypeId}` });
  res.json(context);
});

/** Booking Context Resolver: the full chain for one booking type. */
router.get("/:bookingTypeId", (req, res) => {
  const context = resolveBookingContext(req.params.bookingTypeId);
  if (!context) return res.status(404).json({ message: `Unknown booking type: ${req.params.bookingTypeId}` });
  res.json(context);
});

module.exports = router;
