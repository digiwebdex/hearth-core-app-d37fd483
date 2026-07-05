// Supplier Engine — Phase 2, CRM Architecture Enhancement (approved after CRM review)
// (docs/v2-master/11-Architecture-Freeze.md, docs/v2-master/12-Implementation-Sequence.md Phase 2).
//
// Read-only. Wraps the existing Vendor, VendorBill, VendorBillPayment, and
// VendorNote models exactly as they exist today — no new fields, no write
// path. Does not replace /api/vendors (backend/src/routes/vendors.js),
// which keeps working unchanged.
//
// Per the approved CRM review, every supplier subtype (Airline, Hotel
// Partner, Visa Partner, Tour Operator, Transport Provider, Guide,
// Insurance Company) is handled via Vendor.category — a free-text column
// with no DB-level enum — not as a separate model or engine.
// "insurance" is a genuinely new category value: it doesn't appear in any
// existing route/UI code today (unlike hotel/airline/transport/visa_partner/
// guide/tour_operator/other, all verified in src/pages/Inventory.tsx et al.
// during the CRM review). It's registered here because it was explicitly
// requested and Vendor.category being schema-free means recognizing it
// requires no database change and breaks nothing existing — an agency can
// start tagging Vendor.category = "insurance" the moment this ships.

const { prisma } = require("../middleware/auth");

const SUPPLIER_CATEGORIES = [
  { value: "airline", label: "Airline" },
  { value: "hotel", label: "Hotel Partner" },
  { value: "visa_partner", label: "Visa Partner" },
  { value: "tour_operator", label: "Tour Operator" },
  { value: "transport", label: "Transport Provider" },
  { value: "guide", label: "Guide" },
  { value: "insurance", label: "Insurance Company" },
  { value: "other", label: "Other" },
];
const SUPPLIER_CATEGORY_LABELS = Object.fromEntries(SUPPLIER_CATEGORIES.map((c) => [c.value, c.label]));

/** Pure: label for a category value; falls back to the raw value for anything unrecognized. No database access. */
function getSupplierCategoryLabel(category) {
  return SUPPLIER_CATEGORY_LABELS[category] ?? category;
}

/** Pure: totals a vendor's bills into payables/outstanding-balance aggregates. No database access. */
function summarizePayables(bills) {
  const summary = {
    billCount: bills.length,
    totalBilled: 0,
    totalPaid: 0,
    totalDue: 0,
    byStatus: { unpaid: 0, partial: 0, paid: 0, overdue: 0 },
  };
  for (const bill of bills) {
    summary.totalBilled += bill.totalAmount || 0;
    summary.totalPaid += bill.paidAmount || 0;
    summary.totalDue += bill.dueAmount || 0;
    if (Object.prototype.hasOwnProperty.call(summary.byStatus, bill.status)) {
      summary.byStatus[bill.status] += 1;
    }
  }
  return summary;
}

/** Resolve one supplier's composed context: profile + payables + outstanding balance + summary. Returns null if not found in this tenant. */
async function resolveSupplierContext(vendorId, tenantId) {
  if (!vendorId || !tenantId) return null;

  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, tenantId },
    select: {
      id: true, name: true, phone: true, email: true, category: true, contactPerson: true,
      address: true, serviceAreas: true, website: true, status: true, notes: true, createdAt: true,
    },
  });
  if (!vendor) return null;

  const [bills, notesCount] = await Promise.all([
    prisma.vendorBill.findMany({
      where: { vendorId, tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, description: true, totalAmount: true, paidAmount: true, dueAmount: true,
        status: true, dueDate: true, invoiceRef: true,
        payments: { select: { id: true, amount: true, method: true, date: true } },
      },
    }),
    prisma.vendorNote.count({ where: { vendorId } }),
  ]);

  const summary = summarizePayables(bills);

  return {
    ...vendor,
    categoryLabel: getSupplierCategoryLabel(vendor.category),
    payables: bills,
    outstandingBalance: summary.totalDue,
    summary,
    notesCount,
  };
}

module.exports = {
  SUPPLIER_CATEGORIES,
  getSupplierCategoryLabel,
  summarizePayables,
  resolveSupplierContext,
};
