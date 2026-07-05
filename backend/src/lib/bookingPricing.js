// Booking Pricing Library — shared pure pricing calculations for every
// booking module (Air Ticket, Visa, Hotel, Tour, Hajj, Insurance, ...).
// (docs/v2-master/11-Architecture-Freeze.md §5, docs/v2-master/12-Implementation-Sequence.md Phase 4).
//
// Pure business calculations only: no UI, no CRUD, no API, no database
// access, and — deliberately — no dependency on any Engine or Registry in
// this codebase. This file requires nothing else in the repo; every future
// booking module imports FROM here, this file imports from nowhere.
//
// Field naming intentionally mirrors the existing domain model (Booking's
// amount/cost/profit, Invoice's totalAmount/paidAmount/dueAmount/taxAmount,
// TaxRule's percentage/fixed `type`) so wiring this into a real booking
// create/update flow later is a drop-in, not a re-mapping exercise — but
// nothing here reads or writes those models; that stays each booking
// module's own job (see routes/airTicketBookings.js for the pattern).
//
// Charges (discount, serviceCharge, tax, vat) each accept either a bare
// non-negative number (treated as a fixed amount) or { type: "percentage" |
// "fixed", value }, matching the same shape already used by TaxRule.

const { round2 } = require("./numeric");

function nonNegative(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Resolves a charge (bare number or {type, value}) against a base amount. Never throws. */
function resolveChargeAmount(charge, base) {
  if (charge === undefined || charge === null) return 0;
  if (typeof charge === "number") return round2(nonNegative(charge));
  if (typeof charge !== "object") return 0;
  const type = charge.type === "percentage" ? "percentage" : "fixed";
  const value = nonNegative(charge.value);
  return type === "percentage" ? round2(nonNegative(base) * (value / 100)) : round2(value);
}

/**
 * calculateBookingPricing — the core pure calculation.
 *
 * Input:
 *   buyingPrice          number  — agency's cost (default 0)
 *   sellingPrice         number  — gross price before discount (default 0)
 *   discount             number | {type, value} — reduces sellingPrice
 *   serviceCharge        number | {type, value} — agency fee, added on top of the discounted price
 *   tax                  number | {type, value} — applied on (discountedSellingPrice + serviceCharge)
 *   vat                  number | {type, value} — applied on the same base as tax (not compounded on it)
 *   agentCommissionRate  number  — percentage, applied on discountedSellingPrice (not on tax/VAT/service charge)
 *   paidAmount           number  — amount already paid (default 0)
 *
 * Tax and VAT are pass-through (collected on behalf of an authority) and are
 * excluded from profit/profit margin. Service charge IS agency revenue and
 * is included. dueAmount/balance are NOT clamped at 0 — a negative value
 * means the customer has overpaid (a credit), matching how Invoice's own
 * dueAmount (totalAmount - paid) is computed elsewhere in this codebase.
 */
function calculateBookingPricing(input = {}) {
  const buyingPrice = round2(nonNegative(input.buyingPrice));
  const sellingPrice = round2(nonNegative(input.sellingPrice));
  const paidAmount = round2(nonNegative(input.paidAmount));
  const agentCommissionRate = Math.min(100, nonNegative(input.agentCommissionRate));

  const discountAmount = Math.min(sellingPrice, resolveChargeAmount(input.discount, sellingPrice));
  const discountedSellingPrice = round2(sellingPrice - discountAmount);

  const serviceChargeAmount = resolveChargeAmount(input.serviceCharge, discountedSellingPrice);
  const taxBase = round2(discountedSellingPrice + serviceChargeAmount);
  const taxAmount = resolveChargeAmount(input.tax, taxBase);
  const vatAmount = resolveChargeAmount(input.vat, taxBase);

  const netAmount = round2(discountedSellingPrice + serviceChargeAmount + taxAmount + vatAmount);

  const agentCommissionAmount = round2(discountedSellingPrice * (agentCommissionRate / 100));

  const agencyRevenue = round2(discountedSellingPrice + serviceChargeAmount);
  const profit = round2(agencyRevenue - buyingPrice - agentCommissionAmount);
  const profitMargin = agencyRevenue > 0 ? round2((profit / agencyRevenue) * 100) : 0;

  const dueAmount = round2(netAmount - paidAmount);

  return {
    buyingPrice,
    sellingPrice,
    discountAmount,
    discountedSellingPrice,
    serviceChargeAmount,
    taxAmount,
    vatAmount,
    netAmount,
    agentCommissionRate,
    agentCommissionAmount,
    profit,
    profitMargin,
    paidAmount,
    dueAmount,
    balance: dueAmount,
  };
}

function validateChargeShape(charge, fieldName, errors) {
  if (charge === undefined || charge === null) return;
  if (typeof charge === "number") {
    if (!Number.isFinite(charge) || charge < 0) errors.push(`${fieldName} must be a non-negative number`);
    return;
  }
  if (typeof charge !== "object") {
    errors.push(`${fieldName} must be a number or an object with {type, value}`);
    return;
  }
  if (charge.type !== undefined && !["percentage", "fixed"].includes(charge.type)) {
    errors.push(`${fieldName}.type must be "percentage" or "fixed"`);
  }
  const value = Number(charge.value);
  if (!Number.isFinite(value) || value < 0) {
    errors.push(`${fieldName}.value must be a non-negative number`);
  } else if (charge.type === "percentage" && value > 100) {
    errors.push(`${fieldName}.value cannot exceed 100 when type is "percentage"`);
  }
}

/** validatePricing — pure input-shape/range validation. Never throws; always returns {valid, errors}. */
function validatePricing(input = {}) {
  const errors = [];

  if (input.buyingPrice !== undefined) {
    const buyingPrice = Number(input.buyingPrice);
    if (!Number.isFinite(buyingPrice) || buyingPrice < 0) errors.push("buyingPrice must be a non-negative number");
  }

  const sellingPrice = Number(input.sellingPrice);
  if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
    errors.push("sellingPrice is required and must be a non-negative number");
  }

  validateChargeShape(input.discount, "discount", errors);
  validateChargeShape(input.serviceCharge, "serviceCharge", errors);
  validateChargeShape(input.tax, "tax", errors);
  validateChargeShape(input.vat, "vat", errors);

  if (input.agentCommissionRate !== undefined) {
    const rate = Number(input.agentCommissionRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) errors.push("agentCommissionRate must be between 0 and 100");
  }

  if (input.paidAmount !== undefined) {
    const paid = Number(input.paidAmount);
    if (!Number.isFinite(paid) || paid < 0) errors.push("paidAmount must be a non-negative number");
  }

  if (Number.isFinite(sellingPrice) && input.discount !== undefined && input.discount !== null) {
    const isFixedDiscount = typeof input.discount === "number" || input.discount.type !== "percentage";
    if (isFixedDiscount) {
      const discountValue = typeof input.discount === "number" ? input.discount : Number(input.discount.value) || 0;
      if (discountValue > sellingPrice) errors.push("discount cannot exceed sellingPrice");
    }
  }

  return { valid: errors.length === 0, errors };
}

function derivePaymentStatus(pricing) {
  if (pricing.dueAmount < 0) return "overpaid";
  if (pricing.dueAmount === 0) return "paid";
  if (pricing.paidAmount > 0) return "partial";
  return "unpaid";
}

/** pricingSummary — validates + calculates + a human-readable payment status, composed from the two functions above. */
function pricingSummary(input = {}) {
  const validation = validatePricing(input);
  const pricing = calculateBookingPricing(input);
  return {
    valid: validation.valid,
    errors: validation.errors,
    pricing,
    paymentStatus: derivePaymentStatus(pricing),
  };
}

module.exports = {
  calculateBookingPricing,
  validatePricing,
  pricingSummary,
};
