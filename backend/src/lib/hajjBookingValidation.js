// Hajj & Umrah Booking validation + pure pilgrim/mahram helpers.
// (docs/v2-master/11-Architecture-Freeze.md §4/§5, docs/v2-master/12-Implementation-Sequence.md Phase 4).
//
// Pure — no database access, no side effects. Applied only by
// routes/hajjBookings.js. The mahram logic here is genuinely new (the
// existing HajjPilgrim model has raw mahram string fields but no
// relationship/compliance logic anywhere) — a real Bangladesh-market
// differentiator, not a re-implementation.

const { PACKAGE_TYPES } = require("./hajjDomain");

const GENDERS = ["male", "female", "other"];
// Historically, a female pilgrim below this age required a mahram (guardian).
// Kept as a single documented constant so the rule is easy to adjust.
const MAHRAM_REQUIRED_MAX_AGE = 45;

function isValidDateString(value) {
  return value !== undefined && value !== null && value !== "" && !Number.isNaN(new Date(value).getTime());
}

/** Whole years between a date of birth and asOf. Pure; returns null if dob is invalid. */
function computeAge(dob, asOfIso) {
  if (!isValidDateString(dob)) return null;
  const ms = new Date(asOfIso).getTime() - new Date(dob).getTime();
  if (ms < 0) return null;
  return Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000));
}

/** Validate a hajj/umrah booking payload. Pure — {valid, errors}, never throws. */
function validateHajjBooking(data = {}) {
  const errors = [];

  if (!data.clientId && !String(data.clientName ?? "").trim()) {
    errors.push("clientId or clientName is required");
  }
  if (!PACKAGE_TYPES.includes(data.packageType)) {
    errors.push(`packageType must be one of ${PACKAGE_TYPES.join(", ")}`);
  }
  if (data.departureDate !== undefined && data.departureDate !== "" && !isValidDateString(data.departureDate)) {
    errors.push("departureDate must be a valid date");
  }
  if (data.returnDate !== undefined && data.returnDate !== "" && data.returnDate !== null) {
    if (!isValidDateString(data.returnDate)) {
      errors.push("returnDate must be a valid date");
    } else if (isValidDateString(data.departureDate) && new Date(data.returnDate).getTime() <= new Date(data.departureDate).getTime()) {
      errors.push("returnDate must be after departureDate");
    }
  }
  if (data.amount !== undefined) {
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount < 0) errors.push("amount must be a non-negative number");
  }

  return { valid: errors.length === 0, errors };
}

/** Validate one pilgrim in the booking manifest. Pure. */
function validatePilgrim(p = {}) {
  const errors = [];
  if (!String(p.name ?? "").trim()) errors.push("name is required");
  if (p.gender !== undefined && p.gender !== "" && !GENDERS.includes(p.gender)) {
    errors.push(`gender must be one of ${GENDERS.join(", ")}`);
  }
  if (p.passportNumber !== undefined && p.passportNumber !== "" && !/^[A-Za-z0-9]{6,9}$/.test(String(p.passportNumber).trim())) {
    errors.push("passportNumber must be 6-9 alphanumeric characters");
  }
  if (p.dateOfBirth !== undefined && p.dateOfBirth !== "" && !isValidDateString(p.dateOfBirth)) {
    errors.push("dateOfBirth must be a valid date");
  }
  return { valid: errors.length === 0, errors };
}

/** Add a pilgrim to the manifest. Pure — returns a new array. */
function addPilgrim(pilgrims, pilgrim) {
  const list = Array.isArray(pilgrims) ? pilgrims : [];
  return [...list, {
    id: pilgrim.id,
    name: String(pilgrim.name).trim(),
    gender: pilgrim.gender || null,
    dateOfBirth: pilgrim.dateOfBirth || null,
    passportNumber: pilgrim.passportNumber ? String(pilgrim.passportNumber).trim() : null,
    nationality: pilgrim.nationality || null,
    mahramName: pilgrim.mahramName || null,
    mahramRelation: pilgrim.mahramRelation || null,
    mahramPilgrimId: pilgrim.mahramPilgrimId || null,
    roomType: pilgrim.roomType || null,
    roomNumber: pilgrim.roomNumber || null,
  }];
}

/** Merge an update into a pilgrim by id. Pure — returns a new array (unchanged if id not found). */
function updatePilgrim(pilgrims, pilgrimId, patch) {
  const list = Array.isArray(pilgrims) ? pilgrims : [];
  return list.map((p) => (p.id === pilgrimId ? { ...p, ...patch, id: p.id } : p));
}

/** Remove a pilgrim by id. Pure — returns a new array. */
function removePilgrim(pilgrims, pilgrimId) {
  const list = Array.isArray(pilgrims) ? pilgrims : [];
  return list.filter((p) => p.id !== pilgrimId);
}

/**
 * Build the mahram relationship map + compliance flags for a manifest. Pure.
 * A pilgrim needs a mahram when female and under MAHRAM_REQUIRED_MAX_AGE (or
 * age unknown). "Has a mahram" means either a named mahram or a mahramPilgrimId
 * that resolves to another pilgrim in the same manifest.
 */
function buildMahramMap(pilgrims = [], asOfIso) {
  const byId = new Map(pilgrims.map((p) => [p.id, p]));

  const rows = pilgrims.map((p) => {
    const age = computeAge(p.dateOfBirth, asOfIso);
    const isFemale = p.gender === "female";
    const mahramRequired = isFemale && (age === null || age < MAHRAM_REQUIRED_MAX_AGE);
    const resolvedMahram = p.mahramPilgrimId ? byId.get(p.mahramPilgrimId) : null;
    const hasMahram = Boolean(String(p.mahramName ?? "").trim()) || Boolean(resolvedMahram);
    return {
      id: p.id,
      name: p.name,
      gender: p.gender || null,
      age,
      mahramRequired,
      hasMahram,
      mahramName: p.mahramName || null,
      mahramPilgrimId: p.mahramPilgrimId || null,
      mahramResolvedName: resolvedMahram ? resolvedMahram.name : null,
      compliant: !mahramRequired || hasMahram,
    };
  });

  const missingMahram = rows.filter((r) => !r.compliant).map((r) => r.id);
  return {
    pilgrims: rows,
    missingMahram,
    summary: {
      total: rows.length,
      requiringMahram: rows.filter((r) => r.mahramRequired).length,
      compliant: rows.filter((r) => r.compliant).length,
      nonCompliant: missingMahram.length,
    },
  };
}

module.exports = {
  GENDERS,
  MAHRAM_REQUIRED_MAX_AGE,
  computeAge,
  validateHajjBooking,
  validatePilgrim,
  addPilgrim,
  updatePilgrim,
  removePilgrim,
  buildMahramMap,
};
