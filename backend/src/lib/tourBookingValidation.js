// Tour Booking validation + pure collection helpers (day-wise itinerary,
// destinations, hotel/transport allocation, guide assignment).
// (docs/v2-master/11-Architecture-Freeze.md §5, docs/v2-master/12-Implementation-Sequence.md Phase 4).
//
// Pure — no database access, no side effects. Applied only by
// routes/tourBookings.js. The five serviceDetails sub-collections share one
// generic manipulator set (add/update/remove) but each has its own validator
// + normalizer, defined once in TOUR_COLLECTIONS so the route stays DRY.

const { TOUR_TYPES } = require("./tourDomain");

function isValidDateString(value) {
  return value !== undefined && value !== null && value !== "" && !Number.isNaN(new Date(value).getTime());
}
function required(value) {
  return Boolean(String(value ?? "").trim());
}

/** Validate a tour booking payload. Pure — {valid, errors}, never throws. */
function validateTourBooking(data = {}) {
  const errors = [];

  if (!data.clientId && !required(data.clientName)) errors.push("clientId or clientName is required");
  if (!TOUR_TYPES.includes(data.tourType)) errors.push(`tourType must be one of ${TOUR_TYPES.join(", ")}`);

  if (data.travelDateFrom !== undefined && data.travelDateFrom !== "" && !isValidDateString(data.travelDateFrom)) {
    errors.push("travelDateFrom must be a valid date");
  }
  if (data.travelDateTo !== undefined && data.travelDateTo !== "" && data.travelDateTo !== null) {
    if (!isValidDateString(data.travelDateTo)) {
      errors.push("travelDateTo must be a valid date");
    } else if (isValidDateString(data.travelDateFrom) && new Date(data.travelDateTo).getTime() < new Date(data.travelDateFrom).getTime()) {
      errors.push("travelDateTo cannot be before travelDateFrom");
    }
  }
  if (data.amount !== undefined) {
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount < 0) errors.push("amount must be a non-negative number");
  }

  return { valid: errors.length === 0, errors };
}

/** Validate a traveller (persisted via the shared BookingTraveler model). Pure. */
function validateTraveller(t = {}) {
  const errors = [];
  if (!required(t.name)) errors.push("name is required");
  if (t.passportNumber !== undefined && t.passportNumber !== "" && !/^[A-Za-z0-9]{6,9}$/.test(String(t.passportNumber).trim())) {
    errors.push("passportNumber must be 6-9 alphanumeric characters");
  }
  if (t.dateOfBirth !== undefined && t.dateOfBirth !== "" && !isValidDateString(t.dateOfBirth)) {
    errors.push("dateOfBirth must be a valid date");
  }
  return { valid: errors.length === 0, errors };
}

// ── The five serviceDetails sub-collections: validate + normalize ──
const TOUR_COLLECTIONS = {
  itinerary: {
    validate(body) {
      const errors = [];
      if (!required(body.title)) errors.push("title is required");
      if (body.dayNumber !== undefined && body.dayNumber !== "" && (!Number.isFinite(Number(body.dayNumber)) || Number(body.dayNumber) < 1)) {
        errors.push("dayNumber must be a positive number");
      }
      if (body.date !== undefined && body.date !== "" && !isValidDateString(body.date)) errors.push("date must be a valid date");
      return { valid: errors.length === 0, errors };
    },
    build(body, id) {
      return {
        id,
        dayNumber: body.dayNumber !== undefined && body.dayNumber !== "" ? Number(body.dayNumber) : null,
        date: body.date || null,
        title: String(body.title).trim(),
        description: body.description || null,
        meals: body.meals || null,
        accommodation: body.accommodation || null,
      };
    },
  },
  destinations: {
    validate(body) {
      return required(body.name) ? { valid: true, errors: [] } : { valid: false, errors: ["name is required"] };
    },
    build(body, id) {
      return {
        id,
        name: String(body.name).trim(),
        country: body.country || null,
        nights: body.nights !== undefined && body.nights !== "" ? Number(body.nights) : null,
      };
    },
  },
  hotels: {
    validate(body) {
      return required(body.hotelName) ? { valid: true, errors: [] } : { valid: false, errors: ["hotelName is required"] };
    },
    build(body, id) {
      return {
        id,
        hotelName: String(body.hotelName).trim(),
        city: body.city || null,
        checkInDate: body.checkInDate || null,
        checkOutDate: body.checkOutDate || null,
        nights: body.nights !== undefined && body.nights !== "" ? Number(body.nights) : null,
      };
    },
  },
  transport: {
    validate(body) {
      return required(body.type) ? { valid: true, errors: [] } : { valid: false, errors: ["type is required"] };
    },
    build(body, id) {
      return {
        id,
        type: String(body.type).trim(),
        from: body.from || null,
        to: body.to || null,
        date: body.date || null,
        vendor: body.vendor || null,
        vendorId: body.vendorId || null,
      };
    },
  },
  guides: {
    validate(body) {
      return required(body.name) ? { valid: true, errors: [] } : { valid: false, errors: ["name is required"] };
    },
    build(body, id) {
      return {
        id,
        name: String(body.name).trim(),
        phone: body.phone || null,
        language: body.language || null,
        vendorId: body.vendorId || null,
      };
    },
  },
};
const TOUR_COLLECTION_KEYS = Object.keys(TOUR_COLLECTIONS);

// ── Generic pure manipulators shared by every sub-collection ──
function addCollectionItem(list, item) {
  return [...(Array.isArray(list) ? list : []), item];
}
function updateCollectionItem(list, id, patch) {
  return (Array.isArray(list) ? list : []).map((x) => (x.id === id ? { ...x, ...patch, id: x.id } : x));
}
function removeCollectionItem(list, id) {
  return (Array.isArray(list) ? list : []).filter((x) => x.id !== id);
}

module.exports = {
  validateTourBooking,
  validateTraveller,
  TOUR_COLLECTIONS,
  TOUR_COLLECTION_KEYS,
  addCollectionItem,
  updateCollectionItem,
  removeCollectionItem,
};
