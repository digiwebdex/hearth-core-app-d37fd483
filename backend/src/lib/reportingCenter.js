// Reporting & Analytics Center — pure aggregators, the report registry, the
// shared filter parser, and the export serializers.
// (docs/v2-master/11-Architecture-Freeze.md, docs/v2-master/12-Implementation-Sequence.md).
//
// Pure — no database access, no side effects. The route
// (routes/reportingCenter.js) fetches the tenant-scoped rows and passes them
// in. "No duplicate business logic": the finance KPIs/reports reuse Finance
// Core's pure builders (buildBookLedger, buildAging) rather than
// re-implementing balances/aging; this file only adds the reporting-specific
// aggregation and shaping that doesn't exist yet.
//
// Note on "Branch Filter": branchId filters reports to a single Branch (a real
// tenant-scoped ERP entity — see docs/v2-master/111-SaaS-Plan-System.md). It is
// applied in the route's bookingWhere() where-clause.

const { round2 } = require("./numeric");
function isoDay(value) {
  return value ? String(value).slice(0, 10) : null;
}

// ── Shared report filters (Date Range / Service / Agent / Customer / Supplier / Branch) ──
function parseReportFilters(query = {}) {
  return {
    from: query.from ? isoDay(query.from) : null,
    to: query.to ? isoDay(query.to) : null,
    serviceType: query.serviceType || null,
    bookingType: query.bookingType || null,
    agentId: query.agentId || null,
    customerId: query.customerId || query.clientId || null,
    supplierId: query.supplierId || query.vendorId || null,
    branchId: query.branchId || null, // filter reports to a single Branch
  };
}

/** True if a date (Date or "YYYY-MM-DD"/ISO string) falls within [from, to] (inclusive). Pure. */
function inDateRange(value, from, to) {
  const day = value instanceof Date ? value.toISOString().slice(0, 10) : isoDay(value);
  if (!day) return false;
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

// ── Booking aggregation ──
function summarizeBookings(bookings = []) {
  const summary = { count: bookings.length, amount: 0, cost: 0, profit: 0, paid: 0, due: 0 };
  for (const b of bookings) {
    summary.amount += Number(b.amount) || 0;
    summary.cost += Number(b.cost) || 0;
    summary.profit += Number(b.profit) || 0;
    summary.paid += Number(b.paidAmount) || 0;
    summary.due += Number(b.dueAmount) || 0;
  }
  return {
    count: summary.count,
    amount: round2(summary.amount),
    cost: round2(summary.cost),
    profit: round2(summary.profit),
    paid: round2(summary.paid),
    due: round2(summary.due),
  };
}

/** Group bookings by serviceType with per-service totals (Service-wise Report). Pure. */
function serviceWiseSummary(bookings = []) {
  const map = new Map();
  for (const b of bookings) {
    const key = b.serviceType || b.type || "unknown";
    const row = map.get(key) || { serviceType: key, count: 0, amount: 0, profit: 0 };
    row.count += 1;
    row.amount = round2(row.amount + (Number(b.amount) || 0));
    row.profit = round2(row.profit + (Number(b.profit) || 0));
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

/**
 * Top-N entities by a summed value. Pure.
 *   rows:     any[]
 *   keyFn:    row -> entity id (falsy id skips the row)
 *   labelFn:  row -> display label
 *   valueFn:  row -> numeric contribution
 */
function topEntities(rows = [], keyFn, labelFn, valueFn, n = 10) {
  const map = new Map();
  for (const row of rows) {
    const id = keyFn(row);
    if (!id) continue;
    const entry = map.get(id) || { id, label: labelFn(row), value: 0, count: 0 };
    entry.value = round2(entry.value + (Number(valueFn(row)) || 0));
    entry.count += 1;
    map.set(id, entry);
  }
  return [...map.values()].sort((a, b) => b.value - a.value).slice(0, Math.max(1, n));
}

/** Monthly trend: group rows into YYYY-MM buckets summing valueFn, sorted chronologically. Pure. */
function monthlyTrend(rows = [], dateFn, valueFn) {
  const map = new Map();
  for (const row of rows) {
    const day = (() => {
      const v = dateFn(row);
      return v instanceof Date ? v.toISOString().slice(0, 7) : (v ? String(v).slice(0, 7) : null);
    })();
    if (!day) continue;
    const entry = map.get(day) || { month: day, value: 0, count: 0 };
    entry.value = round2(entry.value + (Number(valueFn(row)) || 0));
    entry.count += 1;
    map.set(day, entry);
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

// ── The report registry (17 reports) ──
const REPORT_REGISTRY = [
  { id: "booking", label: "Booking Report", category: "operations", exportable: true },
  { id: "customer", label: "Customer Report", category: "crm", exportable: true },
  { id: "agent", label: "Agent Report", category: "crm", exportable: true },
  { id: "supplier", label: "Supplier Report", category: "crm", exportable: true },
  { id: "payment", label: "Payment Report", category: "finance", exportable: true },
  { id: "invoice", label: "Invoice Report", category: "finance", exportable: true },
  { id: "profit_loss", label: "Profit & Loss", category: "finance", exportable: true },
  { id: "cash_book", label: "Cash Book", category: "finance", exportable: true },
  { id: "bank_book", label: "Bank Book", category: "finance", exportable: true },
  { id: "commission", label: "Commission Report", category: "finance", exportable: true },
  { id: "due", label: "Due Report", category: "finance", exportable: true },
  { id: "service_wise", label: "Service-wise Report", category: "operations", exportable: true },
  { id: "air_ticket", label: "Air Ticket Report", category: "operations", bookingType: "ticket", exportable: true },
  { id: "visa", label: "Visa Report", category: "operations", bookingType: "visa", exportable: true },
  { id: "hotel", label: "Hotel Report", category: "operations", bookingType: "hotel", exportable: true },
  { id: "hajj_umrah", label: "Hajj & Umrah Report", category: "operations", bookingType: "hajj", exportable: true },
  { id: "tour", label: "Tour Report", category: "operations", bookingType: "tour", exportable: true },
];
const REPORT_BY_ID = Object.fromEntries(REPORT_REGISTRY.map((r) => [r.id, r]));
const PER_SERVICE_BOOKING_REPORTS = REPORT_REGISTRY.filter((r) => r.bookingType).map((r) => r.id);

function getReportRegistry() {
  return REPORT_REGISTRY;
}
function getReport(id) {
  return REPORT_BY_ID[id];
}

// ── Dataset + export serializers ──
function dataset(columns, rows, meta = {}) {
  return { columns, rows, meta };
}

const EXPORT_FORMATS = ["csv", "xlsx", "html"];

function escapeCsv(value) {
  const s = value === undefined || value === null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialize a dataset to CSV. Pure. */
function toCSV(ds) {
  const header = ds.columns.map((c) => escapeCsv(c.label)).join(",");
  const lines = ds.rows.map((row) => ds.columns.map((c) => escapeCsv(row[c.key])).join(","));
  return [header, ...lines].join("\n");
}

function escapeHtml(value) {
  const s = value === undefined || value === null ? "" : String(value);
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Serialize a dataset to a print-ready HTML table (used for browser -> PDF; no PDF dependency). Pure. */
function toHTML(ds, title = "Report") {
  const head = ds.columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("");
  const body = ds.rows
    .map((row) => `<tr>${ds.columns.map((c) => `<td>${escapeHtml(row[c.key])}</td>`).join("")}</tr>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>`
    + `<style>body{font-family:Arial,sans-serif;font-size:12px}table{border-collapse:collapse;width:100%}`
    + `th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#f3f4f6}</style></head><body>`
    + `<h2>${escapeHtml(title)}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}

module.exports = {
  parseReportFilters,
  inDateRange,
  summarizeBookings,
  serviceWiseSummary,
  topEntities,
  monthlyTrend,
  REPORT_REGISTRY,
  PER_SERVICE_BOOKING_REPORTS,
  getReportRegistry,
  getReport,
  dataset,
  EXPORT_FORMATS,
  toCSV,
  toHTML,
};
