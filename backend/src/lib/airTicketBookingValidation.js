// Booking Validation — real validation rules for Air Ticket bookings
// (docs/v2-master/11-Architecture-Freeze.md §5, docs/v2-master/12-Implementation-Sequence.md Phase 4).
//
// Pure — no database access, no side effects. Applied by
// routes/airTicketBookings.js on create/update; the existing generic
// /api/bookings route is untouched and keeps accepting ticket bookings
// without these checks, so nothing already integrated against it can break.

const REQUIRED_TEXT_FIELDS = ["airline", "flightNumber", "pnrNumber", "fromCity", "toCity"];
const CABIN_CLASSES = ["economy", "business", "first"];
const PNR_PATTERN = /^[A-Za-z0-9]{4,8}$/;

function isValidDateString(value) {
  return value !== undefined && value !== null && value !== "" && !Number.isNaN(new Date(value).getTime());
}

/** Validate an air ticket booking payload (post-merge with any existing record for updates). Pure — returns {valid, errors}, never throws. */
function validateAirTicketBooking(data = {}) {
  const errors = [];

  for (const field of REQUIRED_TEXT_FIELDS) {
    if (!String(data[field] ?? "").trim()) errors.push(`${field} is required`);
  }

  if (!data.clientId && !String(data.clientName ?? "").trim()) {
    errors.push("clientId or clientName is required");
  }

  if (!isValidDateString(data.departureDate)) {
    errors.push("departureDate is required and must be a valid date");
  }

  if (data.isRoundTrip) {
    if (!isValidDateString(data.returnDate)) {
      errors.push("returnDate is required and must be a valid date for round-trip bookings");
    } else if (isValidDateString(data.departureDate) && new Date(data.returnDate) < new Date(data.departureDate)) {
      errors.push("returnDate cannot be before departureDate");
    }
  }

  if (data.pnrNumber && !PNR_PATTERN.test(String(data.pnrNumber).trim())) {
    errors.push("pnrNumber must be 4-8 alphanumeric characters");
  }

  if (data.cabinClass !== undefined && !CABIN_CLASSES.includes(data.cabinClass)) {
    errors.push(`cabinClass must be one of ${CABIN_CLASSES.join(", ")}`);
  }

  if (data.ticketDeadline !== undefined && data.ticketDeadline !== "" && !isValidDateString(data.ticketDeadline)) {
    errors.push("ticketDeadline must be a valid date");
  }

  if (data.travelerCount !== undefined) {
    const count = Number(data.travelerCount);
    if (!Number.isFinite(count) || count < 1) errors.push("travelerCount must be at least 1");
  }

  if (data.amount !== undefined) {
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount < 0) errors.push("amount must be a non-negative number");
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateAirTicketBooking, CABIN_CLASSES, REQUIRED_TEXT_FIELDS };
