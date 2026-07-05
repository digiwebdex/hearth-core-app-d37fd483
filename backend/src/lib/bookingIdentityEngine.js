// Booking Identity Engine — shared identity layer, ahead of Booking Foundation
// (docs/v2-master/11-Architecture-Freeze.md §5 "Final Booking Engine",
// docs/v2-master/12-Implementation-Sequence.md Phase 3).
//
// This engine only generates and resolves booking identity strings — it
// does NOT create bookings, does NOT touch the Booking model in a write
// path, and requires NO schema change. Booking has no bookingNumber /
// bookingReference / qrReference column today (only its Prisma `id` UUID
// exists) — this is why the four generators below are pure, stateless
// functions rather than persisted counters (unlike Invoice.invoiceNumber,
// which IS a stored, scanned column). Wiring a real, persisted, guaranteed-
// unique number into Booking is Booking Foundation's job, not this one's.
//
// Read-only architecture where applicable: every generator function here is
// 100% pure (no database access at all). The ONLY place that touches the
// database is previewNextBookingIdentity(), and it only COUNTS existing
// bookings — it never writes, and the numbers it returns are a PREVIEW, not
// a guaranteed-unique reservation (no locking/persistence exists yet — that
// is exactly what Booking Foundation adds when it wires a real column in).

const crypto = require("crypto");
const { prisma } = require("../middleware/auth");
const { BOOKING_TYPE_IDS, resolveServiceType } = require("./bookingRegistry");

// Reuses the same 10 booking types Booking Registry already defined —
// nothing new is introduced here beyond a short display code per type.
const BOOKING_TYPE_CODES = {
  air_ticket: "AT",
  visa: "VS",
  hajj: "HJ",
  umrah: "UM",
  tour: "TR",
  hotel: "HT",
  transport: "TP",
  insurance: "IN",
  student_consultancy: "SC",
  overseas_manpower: "OM",
};
const CODE_TO_BOOKING_TYPE = Object.fromEntries(Object.entries(BOOKING_TYPE_CODES).map(([id, code]) => [code, id]));

function isSupportedBookingType(bookingTypeId) {
  return BOOKING_TYPE_IDS.includes(bookingTypeId);
}

// ── Booking Number Generator ──
// Tenant-wide, type-agnostic sequence — mirrors Invoice's single INV-00001
// style numbering (backend/src/routes/invoices.js), just with a different
// prefix, since Booking has no equivalent stored column to scan today.
function generateBookingNumber(sequence) {
  const n = Math.max(1, Number(sequence) || 1);
  return `BK-${String(n).padStart(6, "0")}`;
}

// ── Booking Reference Generator ──
// Type-aware and year-scoped: {TYPE_CODE}-{YEAR}-{SEQUENCE}, e.g. HJ-2026-00123.
function generateBookingReference({ bookingTypeId, year, sequence }) {
  if (!isSupportedBookingType(bookingTypeId)) return null;
  const code = BOOKING_TYPE_CODES[bookingTypeId];
  const y = Number(year) || new Date().getFullYear();
  const n = Math.max(1, Number(sequence) || 1);
  return `${code}-${y}-${String(n).padStart(5, "0")}`;
}

// ── Public Reference Generator ──
// Short, non-sequential, customer-facing — deliberately NOT derived from the
// sequence (which would leak booking volume to customers). Derived from an
// existing booking id (its Prisma UUID) so it needs no new persisted field:
// the last 8 hex characters of the id, uppercased. For a preview (no real
// booking id yet), a throwaway crypto.randomUUID() stands in — Node's
// built-in UUID generator, already available with zero new dependencies.
function generatePublicReference(bookingId) {
  const id = String(bookingId || "").replace(/-/g, "");
  if (!id) return null;
  return id.slice(-8).toUpperCase();
}

// ── QR Reference Generator ──
// A compact, type-prefixed payload meant to be embedded in an actual QR
// code image later (Booking Foundation / a ticket-and-voucher phase). This
// engine only produces the STRING payload — rendering a real QR image is
// out of scope here (though the `qrcode` package is already a backend
// dependency, used today for TOTP setup in routes/auth.js, and would be the
// natural choice to reuse when that rendering step is built).
function generateQrReference({ bookingTypeId, publicReference }) {
  if (!isSupportedBookingType(bookingTypeId) || !publicReference) return null;
  const code = BOOKING_TYPE_CODES[bookingTypeId];
  return {
    payload: `${code}-${publicReference}`,
    verifyPath: `/bookings/verify/${publicReference}`,
  };
}

// ── Identity Resolver ──
// Pure, no database access: classifies any identity string and decodes what
// it can from its format alone.
function resolveIdentity(identity) {
  const value = String(identity || "").trim();

  let match = value.match(/^BK-(\d{6})$/);
  if (match) {
    return { format: "bookingNumber", value, sequence: Number(match[1]) };
  }

  match = value.match(/^([A-Z]{2})-(\d{4})-(\d{5})$/);
  if (match) {
    const [, code, year, sequence] = match;
    const bookingTypeId = CODE_TO_BOOKING_TYPE[code] ?? null;
    return {
      format: "bookingReference",
      value,
      bookingTypeId,
      typeCode: code,
      year: Number(year),
      sequence: Number(sequence),
    };
  }

  match = value.match(/^([A-Z]{2})-([A-Z0-9]{8})$/);
  if (match) {
    const [, code, publicReference] = match;
    const bookingTypeId = CODE_TO_BOOKING_TYPE[code] ?? null;
    return { format: "qrReference", value, bookingTypeId, typeCode: code, publicReference };
  }

  match = value.match(/^[A-Z0-9]{8}$/);
  if (match) {
    return { format: "publicReference", value, publicReference: value };
  }

  return { format: "unknown", value };
}

// ── Preview orchestrator (the only DB-touching function here) ──
// Reads current booking counts to preview what a new identity WOULD look
// like right now. Never writes anything, and is NOT a reservation — without
// a persisted counter/lock (Booking Foundation's job), a booking created a
// moment later could compute the same preview. Hajj and Umrah share the
// hajj_umrah service type, so their type-scoped counts here are combined,
// not separately tracked — a known limitation of counting by serviceType
// alone (true separation needs HajjPackage.type, only known once a package
// is linked).
async function previewNextBookingIdentity(bookingTypeId, tenantId) {
  if (!isSupportedBookingType(bookingTypeId) || !tenantId) return null;

  const serviceType = resolveServiceType(bookingTypeId);
  const [tenantWideCount, typeScopedCount] = await Promise.all([
    prisma.booking.count({ where: { tenantId } }),
    prisma.booking.count({ where: { tenantId, serviceType: { in: serviceType.serviceTypes } } }),
  ]);

  const year = new Date().getFullYear();
  const bookingNumber = generateBookingNumber(tenantWideCount + 1);
  const bookingReference = generateBookingReference({ bookingTypeId, year, sequence: typeScopedCount + 1 });
  const previewId = crypto.randomUUID();
  const publicReference = generatePublicReference(previewId);
  const qrReference = generateQrReference({ bookingTypeId, publicReference });

  return {
    bookingTypeId,
    isPreview: true,
    bookingNumber,
    bookingReference,
    publicReference,
    qrReference,
  };
}

module.exports = {
  BOOKING_TYPE_CODES,
  isSupportedBookingType,
  generateBookingNumber,
  generateBookingReference,
  generatePublicReference,
  generateQrReference,
  resolveIdentity,
  previewNextBookingIdentity,
};
