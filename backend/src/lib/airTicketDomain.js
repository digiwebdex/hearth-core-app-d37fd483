// Air Ticket Booking Domain — the reference implementation of the frozen
// Generic Booking Engine's "Service Field Registry" concept
// (docs/v2-master/11-Architecture-Freeze.md §5, docs/v2-master/12-Implementation-Sequence.md Phase 4).
//
// This is the FIRST concrete Service Field Registry entry. Every future
// booking module (Visa, Hotel, Tour, Hajj) reuses this exact pattern: a
// declarative field list here, real validation in
// airTicketBookingValidation.js, and a thin type-scoped route
// (routes/airTicketBookings.js) that delegates all shared persistence logic
// to the existing generic bookings.js — never a second Booking model, never
// a parallel CRUD stack.
//
// Naming note (load-bearing, do not conflate): Booking Registry (Phase 3)
// calls this booking type "air_ticket" as its abstract id. The REAL,
// existing Prisma data uses Booking.type = "ticket" (verified against
// src/components/bookings/types.ts's BookingType union and
// emptyForm.type) and Booking.serviceType = "air_ticket" (one of the 14
// canonical SERVICE_TYPES). Both constants below are exported so nothing
// downstream has to guess which one applies where.

const { resolveBookingContext } = require("./bookingRegistry");

const BOOKING_TYPE_ID = "air_ticket"; // Booking Registry's abstract id
const BOOKING_TYPE_VALUE = "ticket"; // the real Booking.type value
const SERVICE_TYPE_VALUE = "air_ticket"; // the real Booking.serviceType value

// Ported 1:1 from the existing src/components/bookings/TicketFields.tsx +
// src/components/bookings/types.ts fields — not invented. These are the
// exact fields already collected by the current air-ticket booking form;
// this registry just makes them declarative instead of hardcoded JSX.
const AIR_TICKET_FIELDS = [
  { key: "airline", label: "Airline", type: "text", required: true },
  { key: "flightNumber", label: "Flight Number", type: "text", required: true },
  { key: "pnrNumber", label: "PNR", type: "text", required: true },
  { key: "fromCity", label: "From (Airport Code)", type: "text", required: true },
  { key: "toCity", label: "To (Airport Code)", type: "text", required: true },
  { key: "departureDate", label: "Departure Date", type: "date", required: true },
  { key: "returnDate", label: "Return Date", type: "date", required: false },
  { key: "isRoundTrip", label: "Round Trip", type: "boolean", required: false, default: false },
  { key: "cabinClass", label: "Cabin Class", type: "select", required: false, options: ["economy", "business", "first"], default: "economy" },
  { key: "ticketDeadline", label: "Ticket Deadline", type: "date", required: false },
];

function getAirTicketFields() {
  return AIR_TICKET_FIELDS;
}

/** The full domain: field registry + the Booking Registry context (workflow, required customer/supplier type, status flow, payment flow) for air_ticket. */
function resolveAirTicketDomain() {
  return {
    bookingTypeId: BOOKING_TYPE_ID,
    bookingTypeValue: BOOKING_TYPE_VALUE,
    serviceTypeValue: SERVICE_TYPE_VALUE,
    fields: AIR_TICKET_FIELDS,
    bookingContext: resolveBookingContext(BOOKING_TYPE_ID),
  };
}

module.exports = {
  BOOKING_TYPE_ID,
  BOOKING_TYPE_VALUE,
  SERVICE_TYPE_VALUE,
  AIR_TICKET_FIELDS,
  getAirTicketFields,
  resolveAirTicketDomain,
};
