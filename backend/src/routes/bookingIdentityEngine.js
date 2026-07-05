// Identity API — Booking Identity Engine
// (docs/v2-master/11-Architecture-Freeze.md §5, docs/v2-master/12-Implementation-Sequence.md Phase 3).
//
// No booking creation, no writes. /preview only reads (counts existing
// bookings) to show what an identity WOULD look like right now — it does
// not reserve or persist anything. /resolve is pure string parsing, no
// database access at all.

const router = require("express").Router();
const { authenticate } = require("../middleware/auth");
const { BOOKING_TYPE_CODES, resolveIdentity, previewNextBookingIdentity } = require("../lib/bookingIdentityEngine");

router.use(authenticate);

/** The 10 supported booking types and their identity type codes. */
router.get("/types", (_req, res) => {
  res.json({ types: BOOKING_TYPE_CODES });
});

/** Preview (not reserve) the next booking number/reference/public reference/QR reference for this tenant + booking type. */
router.get("/preview/:bookingTypeId", async (req, res) => {
  try {
    const preview = await previewNextBookingIdentity(req.params.bookingTypeId, req.tenantId);
    if (!preview) return res.status(404).json({ message: `Unknown booking type: ${req.params.bookingTypeId}` });
    res.json(preview);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to preview booking identity" });
  }
});

/** Identity Resolver: classify and decode any identity string (booking number, reference, public reference, or QR payload). */
router.get("/resolve/:identity", (req, res) => {
  res.json(resolveIdentity(req.params.identity));
});

module.exports = router;
