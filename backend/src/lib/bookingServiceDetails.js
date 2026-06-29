/** @typedef {import('@prisma/client').Prisma.JsonValue} JsonValue */

const BOOKING_SCALAR_KEYS = new Set([
  "id",
  "type",
  "title",
  "clientId",
  "agentId",
  "quotationId",
  "packageId",
  "serviceType",
  "packageTitleSnapshot",
  "packageCodeSnapshot",
  "destination",
  "travelDateFrom",
  "travelDateTo",
  "travelerCount",
  "amount",
  "cost",
  "profit",
  "paidAmount",
  "dueAmount",
  "paymentStatus",
  "status",
  "assignedTo",
  "supplierName",
  "supplierRef",
  "internalNotes",
  "serviceDetails",
  "opsStatus",
  "followUpDate",
  "followUpNote",
  "tenantId",
  "createdAt",
  "updatedAt",
]);

function asObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function parseServiceDetails(raw) {
  return asObject(raw);
}

function flattenServiceDetails(record) {
  const details = parseServiceDetails(record?.serviceDetails);
  return { ...record, ...details, serviceDetails: details };
}

function buildListWhere(tenantId, query = {}) {
  const where = { tenantId };
  if (query.type) where.type = String(query.type);
  if (query.opsStatus) where.opsStatus = String(query.opsStatus);
  if (query.status) where.status = String(query.status);
  return where;
}

function pickServiceDetailsPayload(body) {
  const next = { ...body };
  const explicit = asObject(next.serviceDetails);
  delete next.serviceDetails;

  const merged = { ...explicit };
  for (const [key, value] of Object.entries(next)) {
    if (BOOKING_SCALAR_KEYS.has(key)) continue;
    if (value === undefined || value === null || value === "") continue;
    merged[key] = value;
    delete next[key];
  }

  if (Object.keys(merged).length > 0) {
    next.serviceDetails = merged;
  }

  return next;
}

module.exports = {
  parseServiceDetails,
  flattenServiceDetails,
  buildListWhere,
  pickServiceDetailsPayload,
  BOOKING_SCALAR_KEYS,
};
