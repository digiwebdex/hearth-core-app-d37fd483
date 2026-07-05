// Document Registry — pure metadata + helpers for the Shared Document Engine.
// (docs/v2-master/11-Architecture-Freeze.md, docs/v2-master/12-Implementation-Sequence.md).
//
// Pure: no database access, no side effects. The route
// (routes/documentEngine.js) wires these to Prisma + the shared multer
// upload. Defines which entities can own documents, the document category
// catalog, and the pure array manipulators for versions/history/shares.
//
// Reuse (no duplication): the booking entity types are cross-checked against
// Booking Registry's BOOKING_TYPE_IDS (see the assertion in the test) so the
// two can never drift; each entity maps to an existing RBAC module so the
// Permission Engine — not a new permission scheme — governs document access.

const { BOOKING_TYPE_IDS } = require("./bookingRegistry");

// The 9 supported modules from the brief. `rbacModule` is an existing
// Permission Engine module (see backend/src/middleware/auth.js ROLE_PERMISSIONS)
// so document permissions reuse the existing role matrix.
const ENTITY_TYPES = [
  { key: "air_ticket", label: "Air Ticket Booking", rbacModule: "bookings", source: "booking" },
  { key: "visa", label: "Visa Booking", rbacModule: "bookings", source: "booking" },
  { key: "hotel", label: "Hotel Booking", rbacModule: "bookings", source: "booking" },
  { key: "tour", label: "Tour Booking", rbacModule: "bookings", source: "booking" },
  { key: "hajj", label: "Hajj Booking", rbacModule: "hajj_umrah", source: "booking" },
  { key: "customer", label: "Customer", rbacModule: "clients", source: "crm" },
  { key: "supplier", label: "Supplier", rbacModule: "vendors", source: "crm" },
  { key: "invoice", label: "Invoice", rbacModule: "invoices", source: "finance" },
  { key: "employee", label: "Employee", rbacModule: "team", source: "hr" },
];
const ENTITY_TYPE_BY_KEY = Object.fromEntries(ENTITY_TYPES.map((e) => [e.key, e]));
const ENTITY_TYPE_KEYS = ENTITY_TYPES.map((e) => e.key);

// Booking-sourced entity keys must all be real Booking Registry types.
const BOOKING_ENTITY_KEYS = ENTITY_TYPES.filter((e) => e.source === "booking").map((e) => e.key);

const DOCUMENT_CATEGORIES = [
  { key: "passport", label: "Passport" },
  { key: "visa", label: "Visa Copy" },
  { key: "ticket", label: "Ticket" },
  { key: "id_card", label: "National ID / NID" },
  { key: "photo", label: "Photograph" },
  { key: "contract", label: "Contract / Agreement" },
  { key: "invoice", label: "Invoice / Receipt" },
  { key: "medical", label: "Medical Report" },
  { key: "certificate", label: "Certificate" },
  { key: "bank_statement", label: "Bank Statement" },
  { key: "other", label: "Other" },
];
const DOCUMENT_CATEGORY_KEYS = new Set(DOCUMENT_CATEGORIES.map((c) => c.key));

const VERIFICATION_STATUS_SET_ID = "documentVerificationStatus"; // resolved via Status Engine

function isSupportedEntityType(entityType) {
  return Object.prototype.hasOwnProperty.call(ENTITY_TYPE_BY_KEY, entityType);
}
function getEntityRbacModule(entityType) {
  return ENTITY_TYPE_BY_KEY[entityType]?.rbacModule || null;
}
function isKnownCategory(category) {
  return DOCUMENT_CATEGORY_KEYS.has(category);
}

/** Full registry payload (entity types, categories, verification set id). Pure. */
function getDocumentRegistry() {
  return { entityTypes: ENTITY_TYPES, categories: DOCUMENT_CATEGORIES, verificationStatusSetId: VERIFICATION_STATUS_SET_ID };
}

// ── Validation ──
function isValidDateString(value) {
  return value !== undefined && value !== null && value !== "" && !Number.isNaN(new Date(value).getTime());
}

/** Validate a document create/update payload. Pure; {valid, errors}, never throws. */
function validateDocumentInput(input = {}, { requireEntity = true } = {}) {
  const errors = [];

  if (!String(input.title ?? "").trim()) errors.push("title is required");

  if (input.category !== undefined && !isKnownCategory(input.category)) {
    errors.push(`category must be one of: ${[...DOCUMENT_CATEGORY_KEYS].join(", ")}`);
  }

  if (requireEntity) {
    if (!isSupportedEntityType(input.entityType)) {
      errors.push(`entityType must be one of: ${ENTITY_TYPE_KEYS.join(", ")}`);
    }
    if (!String(input.entityId ?? "").trim()) errors.push("entityId is required");
  }

  if (input.expiryDate !== undefined && input.expiryDate !== "" && input.expiryDate !== null && !isValidDateString(input.expiryDate)) {
    errors.push("expiryDate must be a valid date");
  }

  if (input.tags !== undefined && !Array.isArray(input.tags)) {
    errors.push("tags must be an array of strings");
  }

  return { valid: errors.length === 0, errors };
}

// ── Pure structural manipulators (versions / history / shares) ──
function nextVersionNumber(document) {
  return (Number(document?.currentVersion) || 0) + 1;
}

/** Build one version entry. `uploadedAt` is passed in (keeps this pure/testable). */
function buildVersionEntry({ versionNumber, fileName, url, mimeType, size, uploadedBy, uploadedAt }) {
  return {
    versionNumber,
    fileName: fileName || null,
    url: url || null,
    mimeType: mimeType || null,
    size: size ?? null,
    uploadedBy: uploadedBy || null,
    uploadedAt,
  };
}

/** Append an immutable history entry. Pure — returns a new array. */
function appendHistory(history, { action, actorId, detail, at }) {
  const list = Array.isArray(history) ? history : [];
  return [...list, { action, actorId: actorId || null, detail: detail || null, at }];
}

/** Build a share entry. Pure. */
function buildShareEntry({ id, sharedWith, note, expiresAt, createdBy, createdAt }) {
  return { id, sharedWith: sharedWith || null, note: note || null, expiresAt: expiresAt || null, createdBy: createdBy || null, createdAt };
}

/** Remove a share by id. Pure — returns a new array. */
function revokeShare(shares, shareId) {
  const list = Array.isArray(shares) ? shares : [];
  return list.filter((s) => s.id !== shareId);
}

/** True if an expiry date is on/before asOf. Pure. */
function isExpired(expiryDate, asOfIso) {
  if (!isValidDateString(expiryDate)) return false;
  return new Date(expiryDate).getTime() <= new Date(asOfIso).getTime();
}

/** True if an expiry date falls within `days` after asOf (and isn't already past). Pure. */
function isExpiringWithin(expiryDate, asOfIso, days) {
  if (!isValidDateString(expiryDate)) return false;
  const expiry = new Date(expiryDate).getTime();
  const asOf = new Date(asOfIso).getTime();
  const horizon = asOf + Number(days) * 24 * 60 * 60 * 1000;
  return expiry > asOf && expiry <= horizon;
}

module.exports = {
  ENTITY_TYPES,
  ENTITY_TYPE_KEYS,
  BOOKING_ENTITY_KEYS,
  BOOKING_TYPE_IDS, // re-exported so tests can assert booking entities are real Booking Registry types
  DOCUMENT_CATEGORIES,
  VERIFICATION_STATUS_SET_ID,
  isSupportedEntityType,
  getEntityRbacModule,
  isKnownCategory,
  getDocumentRegistry,
  validateDocumentInput,
  nextVersionNumber,
  buildVersionEntry,
  appendHistory,
  buildShareEntry,
  revokeShare,
  isExpired,
  isExpiringWithin,
};
