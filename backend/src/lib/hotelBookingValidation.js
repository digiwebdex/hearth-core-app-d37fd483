// Hotel Booking validation + pure hotel helpers (room assignment, nights,
// check-in/out ordering).
// (docs/v2-master/11-Architecture-Freeze.md §5, docs/v2-master/12-Implementation-Sequence.md Phase 4).
//
// Pure — no database access, no side effects. Applied only by
// routes/hotelBookings.js; the existing generic /api/bookings route is
// untouched and keeps accepting hotel bookings without these checks.

const ROOM_TYPES = ["single", "double", "twin", "triple", "suite", "other"];

function isValidDateString(value) {
  return value !== undefined && value !== null && value !== "" && !Number.isNaN(new Date(value).getTime());
}

/** Whole nights between check-in and check-out. Pure; returns 0 if either date is invalid. */
function computeNights(checkInDate, checkOutDate) {
  if (!isValidDateString(checkInDate) || !isValidDateString(checkOutDate)) return 0;
  const ms = new Date(checkOutDate).getTime() - new Date(checkInDate).getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

/** Validate a hotel booking payload (post-merge with any existing record for updates). Pure — {valid, errors}, never throws. */
function validateHotelBooking(data = {}) {
  const errors = [];

  if (!String(data.hotelName ?? "").trim()) errors.push("hotelName is required");

  if (!data.clientId && !String(data.clientName ?? "").trim()) {
    errors.push("clientId or clientName is required");
  }

  if (!isValidDateString(data.checkInDate)) errors.push("checkInDate is required and must be a valid date");
  if (!isValidDateString(data.checkOutDate)) {
    errors.push("checkOutDate is required and must be a valid date");
  } else if (isValidDateString(data.checkInDate) && new Date(data.checkOutDate).getTime() <= new Date(data.checkInDate).getTime()) {
    errors.push("checkOutDate must be after checkInDate");
  }

  if (data.roomType !== undefined && !ROOM_TYPES.includes(data.roomType)) {
    errors.push(`roomType must be one of ${ROOM_TYPES.join(", ")}`);
  }
  if (data.roomCount !== undefined) {
    const roomCount = Number(data.roomCount);
    if (!Number.isFinite(roomCount) || roomCount < 1) errors.push("roomCount must be at least 1");
  }
  if (data.guestCount !== undefined) {
    const guestCount = Number(data.guestCount);
    if (!Number.isFinite(guestCount) || guestCount < 1) errors.push("guestCount must be at least 1");
  }
  if (data.amount !== undefined) {
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount < 0) errors.push("amount must be a non-negative number");
  }

  return { valid: errors.length === 0, errors };
}

/** Validate a single room-assignment payload. Pure. */
function validateRoomAssignment(room = {}) {
  const errors = [];
  if (!String(room.roomNumber ?? "").trim()) errors.push("roomNumber is required");
  if (room.roomType !== undefined && !ROOM_TYPES.includes(room.roomType)) {
    errors.push(`roomType must be one of ${ROOM_TYPES.join(", ")}`);
  }
  if (room.guestNames !== undefined && !Array.isArray(room.guestNames)) {
    errors.push("guestNames must be an array");
  }
  return { valid: errors.length === 0, errors };
}

/** Add a room to a rooms array. Pure — returns a new array. */
function addRoom(rooms, room) {
  const list = Array.isArray(rooms) ? rooms : [];
  return [...list, {
    id: room.id,
    roomNumber: String(room.roomNumber).trim(),
    roomType: room.roomType || null,
    guestNames: Array.isArray(room.guestNames) ? room.guestNames.map((g) => String(g).trim()).filter(Boolean) : [],
  }];
}

/** Remove a room by id. Pure — returns a new array. */
function removeRoom(rooms, roomId) {
  const list = Array.isArray(rooms) ? rooms : [];
  return list.filter((r) => r.id !== roomId);
}

module.exports = {
  ROOM_TYPES,
  computeNights,
  validateHotelBooking,
  validateRoomAssignment,
  addRoom,
  removeRoom,
};
