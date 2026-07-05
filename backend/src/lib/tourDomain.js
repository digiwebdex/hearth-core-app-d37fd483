// Tour Booking Domain — the fifth Service Field Registry entry, reusing the
// exact pattern the earlier booking modules established.
// (docs/v2-master/11-Architecture-Freeze.md §5, docs/v2-master/12-Implementation-Sequence.md Phase 4).
//
// One unified Tour module for both Domestic and International (business rule):
// Booking.type = "tour" for both, distinguished by serviceDetails.tourType
// ("domestic" | "international") which maps to the real serviceType
// ("tour_domestic" | "tour_international"). Booking Registry's "tour" type
// already spans both service types and cross-references the tourStatus set.

const { resolveBookingContext } = require("./bookingRegistry");

const BOOKING_TYPE_ID = "tour";
const BOOKING_TYPE_VALUE = "tour";
const TOUR_TYPES = ["domestic", "international"];

/** Maps the unified tourType to the real 14-value serviceType. */
function serviceTypeForTourType(tourType) {
  return tourType === "international" ? "tour_international" : "tour_domestic";
}

// Booking-level (sale) fields, from src/components/bookings/types.ts's Tour
// block plus the domestic/international selector. Itinerary, destinations,
// hotels, transport, guides and travellers are managed as sub-resources
// (see routes/tourBookings.js), not flat fields.
const TOUR_FIELDS = [
  { key: "tourType", label: "Tour Type", type: "select", required: true, options: TOUR_TYPES },
  { key: "destination", label: "Primary Destination", type: "text", required: false },
  { key: "tourOperator", label: "Tour Operator", type: "text", required: false },
  { key: "travelDateFrom", label: "Start Date", type: "date", required: false },
  { key: "travelDateTo", label: "End Date", type: "date", required: false },
  { key: "travelerCount", label: "Travellers", type: "number", required: false, default: 1 },
  { key: "includesHotel", label: "Includes Hotel", type: "boolean", required: false, default: false },
  { key: "includesTransfer", label: "Includes Transfer", type: "boolean", required: false, default: false },
];

function getTourFields() {
  return TOUR_FIELDS;
}

/** The full domain: field registry + the Booking Registry context (workflow, status flow, payment flow) for tour. */
function resolveTourDomain() {
  return {
    bookingTypeId: BOOKING_TYPE_ID,
    bookingTypeValue: BOOKING_TYPE_VALUE,
    tourTypes: TOUR_TYPES,
    fields: TOUR_FIELDS,
    bookingContext: resolveBookingContext(BOOKING_TYPE_ID),
  };
}

module.exports = {
  BOOKING_TYPE_ID,
  BOOKING_TYPE_VALUE,
  TOUR_TYPES,
  TOUR_FIELDS,
  serviceTypeForTourType,
  getTourFields,
  resolveTourDomain,
};
