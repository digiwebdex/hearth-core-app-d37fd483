// Hajj & Umrah Booking Domain — the fourth Service Field Registry entry.
// (docs/v2-master/11-Architecture-Freeze.md §4/§5, docs/v2-master/12-Implementation-Sequence.md Phase 4).
//
// TWO-LAYER design, per the freeze (§4): "Hajj/Umrah keeps its Operations
// desk (pilgrims, groups, rooming, installments) as the bulk special case,
// but a Hajj sale is still a Booking in the engine." This module is the
// SALE/BOOKING layer (a generic Booking of type "hajj", serviceType
// "hajj_umrah"), exactly like the Air Ticket / Visa / Hotel modules. The
// existing Operations desk (backend/src/routes/hajj.js managing HajjPackage /
// HajjGroup / HajjPilgrim / HajjPilgrimPayment) is UNTOUCHED and NOT
// re-implemented — this module COMPOSES those models (read) for itinerary /
// hotel / flight / group, and links a booking to them.
//
// One module handles both Hajj and Umrah (business rule): both are
// Booking.type = "hajj" with serviceType "hajj_umrah", distinguished by
// serviceDetails.packageType ("hajj" | "umrah"). Booking Registry defines
// both as separate booking types (packageTypeValue "hajj"/"umrah") sharing
// the hajj_umrah service type — this domain exposes both contexts.

const { resolveBookingContext } = require("./bookingRegistry");

const BOOKING_TYPE_VALUE = "hajj"; // the real Booking.type value for every hajj/umrah sale
const SERVICE_TYPE_VALUE = "hajj_umrah";
const PACKAGE_TYPES = ["hajj", "umrah"];

// Booking-level (sale) fields. These mirror the HajjPackage operations model's
// key fields (name/nights/hotels/dates) so a booking can carry its own package
// summary, or link to a real HajjPackage (see hajjPackageId) for the full
// operations record. Pilgrims + mahram are managed as a sub-resource, not
// flat fields (see routes/hajjBookings.js).
const HAJJ_FIELDS = [
  { key: "packageType", label: "Package Type", type: "select", required: true, options: PACKAGE_TYPES },
  { key: "packageName", label: "Package Name", type: "text", required: false },
  { key: "departureDate", label: "Departure Date", type: "date", required: false },
  { key: "returnDate", label: "Return Date", type: "date", required: false },
  { key: "makkahNights", label: "Makkah Nights", type: "number", required: false, default: 0 },
  { key: "madinahNights", label: "Madinah Nights", type: "number", required: false, default: 0 },
  { key: "makkahHotel", label: "Makkah Hotel", type: "text", required: false },
  { key: "madinahHotel", label: "Madinah Hotel", type: "text", required: false },
  { key: "pilgrimCount", label: "Pilgrim Count", type: "number", required: false, default: 1 },
  { key: "hajjPackageId", label: "Linked Hajj Package", type: "text", required: false },
  { key: "hajjGroupId", label: "Linked Hajj Group", type: "text", required: false },
];

function getHajjFields() {
  return HAJJ_FIELDS;
}

/** The full domain: field registry + both Booking Registry contexts (hajj + umrah) it can produce. */
function resolveHajjDomain() {
  return {
    bookingTypeValue: BOOKING_TYPE_VALUE,
    serviceTypeValue: SERVICE_TYPE_VALUE,
    packageTypes: PACKAGE_TYPES,
    fields: HAJJ_FIELDS,
    bookingContext: {
      hajj: resolveBookingContext("hajj"),
      umrah: resolveBookingContext("umrah"),
    },
  };
}

module.exports = {
  BOOKING_TYPE_VALUE,
  SERVICE_TYPE_VALUE,
  PACKAGE_TYPES,
  HAJJ_FIELDS,
  getHajjFields,
  resolveHajjDomain,
};
