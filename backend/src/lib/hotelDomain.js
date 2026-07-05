// Hotel Booking Domain — the third Service Field Registry entry, reusing the
// exact pattern airTicketDomain.js / visaDomain.js established
// (docs/v2-master/11-Architecture-Freeze.md §5, docs/v2-master/12-Implementation-Sequence.md Phase 4).
//
// Booking Registry's abstract id, the real Booking.type value, and
// Booking.serviceType are all "hotel" here.

const { resolveBookingContext } = require("./bookingRegistry");

const BOOKING_TYPE_ID = "hotel";
const BOOKING_TYPE_VALUE = "hotel";
const SERVICE_TYPE_VALUE = "hotel";

// Ported 1:1 from the existing src/components/bookings/types.ts "Hotel"
// field block (and RoomType union) — not invented.
const HOTEL_FIELDS = [
  { key: "hotelName", label: "Hotel Name", type: "text", required: true },
  { key: "hotelCity", label: "City", type: "text", required: false },
  { key: "hotelCountry", label: "Country", type: "text", required: false },
  { key: "checkInDate", label: "Check-in Date", type: "date", required: true },
  { key: "checkOutDate", label: "Check-out Date", type: "date", required: true },
  { key: "roomType", label: "Room Type", type: "select", required: false, options: ["single", "double", "twin", "triple", "suite", "other"], default: "double" },
  { key: "roomCount", label: "Rooms", type: "number", required: false, default: 1 },
  { key: "guestCount", label: "Guests", type: "number", required: false, default: 1 },
  { key: "confirmationNumber", label: "Confirmation Number", type: "text", required: false },
];

function getHotelFields() {
  return HOTEL_FIELDS;
}

/** The full domain: field registry + the Booking Registry context (workflow, required customer/supplier type, status flow, payment flow) for hotel. */
function resolveHotelDomain() {
  return {
    bookingTypeId: BOOKING_TYPE_ID,
    bookingTypeValue: BOOKING_TYPE_VALUE,
    serviceTypeValue: SERVICE_TYPE_VALUE,
    fields: HOTEL_FIELDS,
    bookingContext: resolveBookingContext(BOOKING_TYPE_ID),
  };
}

module.exports = {
  BOOKING_TYPE_ID,
  BOOKING_TYPE_VALUE,
  SERVICE_TYPE_VALUE,
  HOTEL_FIELDS,
  getHotelFields,
  resolveHotelDomain,
};
