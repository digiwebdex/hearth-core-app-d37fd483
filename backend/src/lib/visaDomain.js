// Visa Booking Domain — the second Service Field Registry entry, reusing
// the exact pattern airTicketDomain.js established
// (docs/v2-master/11-Architecture-Freeze.md §5, docs/v2-master/12-Implementation-Sequence.md Phase 4).
//
// Unlike Air Ticket, Booking Registry's abstract id ("visa"), the real
// Booking.type value ("visa"), and Booking.serviceType ("visa") are all the
// same literal string here — still named as three distinct constants for
// consistency with the reference implementation and in case they ever
// diverge for a future booking type.

const { resolveBookingContext } = require("./bookingRegistry");

const BOOKING_TYPE_ID = "visa";
const BOOKING_TYPE_VALUE = "visa";
const SERVICE_TYPE_VALUE = "visa";

// Ported 1:1 from the existing src/components/bookings/types.ts "Visa"
// field block — not invented.
const VISA_FIELDS = [
  { key: "visaCountry", label: "Visa Country", type: "text", required: true },
  { key: "visaType", label: "Visa Type", type: "text", required: true },
  { key: "passportNumber", label: "Passport Number", type: "text", required: true },
  { key: "passportExpiry", label: "Passport Expiry", type: "date", required: true },
  { key: "applicationDate", label: "Application Date", type: "date", required: false },
  { key: "appointmentDate", label: "Appointment Date", type: "date", required: false },
  { key: "submissionDate", label: "Submission Date", type: "date", required: false },
  { key: "expectedApprovalDate", label: "Expected Approval Date", type: "date", required: false },
  { key: "visaFee", label: "Visa Fee", type: "number", required: false, default: 0 },
  { key: "serviceFee", label: "Service Fee", type: "number", required: false, default: 0 },
];

function getVisaFields() {
  return VISA_FIELDS;
}

/** The full domain: field registry + the Booking Registry context (workflow, required customer/supplier type, status flow, payment flow) for visa. */
function resolveVisaDomain() {
  return {
    bookingTypeId: BOOKING_TYPE_ID,
    bookingTypeValue: BOOKING_TYPE_VALUE,
    serviceTypeValue: SERVICE_TYPE_VALUE,
    fields: VISA_FIELDS,
    bookingContext: resolveBookingContext(BOOKING_TYPE_ID),
  };
}

module.exports = {
  BOOKING_TYPE_ID,
  BOOKING_TYPE_VALUE,
  SERVICE_TYPE_VALUE,
  VISA_FIELDS,
  getVisaFields,
  resolveVisaDomain,
};
