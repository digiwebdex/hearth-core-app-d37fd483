// Booking Validation — real validation rules for Visa bookings
// (docs/v2-master/11-Architecture-Freeze.md §5, docs/v2-master/12-Implementation-Sequence.md Phase 4).
//
// Pure — no database access, no side effects. Applied only by
// routes/visaBookings.js; the existing generic /api/bookings route is
// untouched and keeps accepting visa bookings without these checks.

function isValidDateString(value) {
  return value !== undefined && value !== null && value !== "" && !Number.isNaN(new Date(value).getTime());
}

const OPTIONAL_DATE_FIELDS = ["applicationDate", "appointmentDate", "submissionDate", "expectedApprovalDate"];

/** Validate a visa booking payload (post-merge with any existing record for updates). Pure — returns {valid, errors}, never throws. */
function validateVisaBooking(data = {}) {
  const errors = [];

  if (!String(data.visaCountry ?? "").trim()) errors.push("visaCountry is required");
  if (!String(data.visaType ?? "").trim()) errors.push("visaType is required");

  if (!data.clientId && !String(data.clientName ?? "").trim()) {
    errors.push("clientId or clientName is required");
  }

  const passportNumber = String(data.passportNumber ?? "").trim();
  if (!passportNumber) {
    errors.push("passportNumber is required");
  } else if (!/^[A-Za-z0-9]{6,9}$/.test(passportNumber)) {
    errors.push("passportNumber must be 6-9 alphanumeric characters");
  }

  if (!isValidDateString(data.passportExpiry)) {
    errors.push("passportExpiry is required and must be a valid date");
  } else if (new Date(data.passportExpiry).getTime() <= Date.now()) {
    // A genuinely new rule beyond Air Ticket's validation: an expired (or
    // expiring today) passport cannot be used for a fresh visa application —
    // a common, real rejection reason for Bangladeshi travel agencies.
    errors.push("passportExpiry must be in the future — an expired passport cannot be used for a visa application");
  }

  for (const field of OPTIONAL_DATE_FIELDS) {
    if (data[field] !== undefined && data[field] !== "" && !isValidDateString(data[field])) {
      errors.push(`${field} must be a valid date`);
    }
  }

  if (data.visaFee !== undefined) {
    const visaFee = Number(data.visaFee);
    if (!Number.isFinite(visaFee) || visaFee < 0) errors.push("visaFee must be a non-negative number");
  }
  if (data.serviceFee !== undefined) {
    const serviceFee = Number(data.serviceFee);
    if (!Number.isFinite(serviceFee) || serviceFee < 0) errors.push("serviceFee must be a non-negative number");
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateVisaBooking, OPTIONAL_DATE_FIELDS };
