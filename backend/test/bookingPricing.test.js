const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { calculateBookingPricing, validatePricing, pricingSummary } = require("../src/lib/bookingPricing");

describe("calculateBookingPricing — basic case, no discount/charges/commission", () => {
  it("computes netAmount, profit, profitMargin, and dueAmount for a plain sale", () => {
    const result = calculateBookingPricing({ buyingPrice: 700, sellingPrice: 1000, paidAmount: 0 });
    assert.equal(result.discountAmount, 0);
    assert.equal(result.discountedSellingPrice, 1000);
    assert.equal(result.serviceChargeAmount, 0);
    assert.equal(result.taxAmount, 0);
    assert.equal(result.vatAmount, 0);
    assert.equal(result.netAmount, 1000);
    assert.equal(result.agentCommissionAmount, 0);
    assert.equal(result.profit, 300);
    assert.equal(result.profitMargin, 30);
    assert.equal(result.dueAmount, 1000);
    assert.equal(result.balance, result.dueAmount);
  });

  it("defaults every missing optional field to 0, without throwing", () => {
    const result = calculateBookingPricing({});
    assert.equal(result.buyingPrice, 0);
    assert.equal(result.sellingPrice, 0);
    assert.equal(result.netAmount, 0);
    assert.equal(result.profit, 0);
    assert.equal(result.profitMargin, 0);
    assert.equal(result.dueAmount, 0);
  });

  it("floors negative buyingPrice/sellingPrice/paidAmount at 0 defensively", () => {
    const result = calculateBookingPricing({ buyingPrice: -50, sellingPrice: -100, paidAmount: -10 });
    assert.equal(result.buyingPrice, 0);
    assert.equal(result.sellingPrice, 0);
    assert.equal(result.paidAmount, 0);
  });
});

describe("calculateBookingPricing — discount", () => {
  it("applies a percentage discount against sellingPrice", () => {
    const result = calculateBookingPricing({ sellingPrice: 1000, discount: { type: "percentage", value: 10 } });
    assert.equal(result.discountAmount, 100);
    assert.equal(result.discountedSellingPrice, 900);
  });

  it("applies a bare number as a fixed discount", () => {
    const result = calculateBookingPricing({ sellingPrice: 1000, discount: 50 });
    assert.equal(result.discountAmount, 50);
    assert.equal(result.discountedSellingPrice, 950);
  });

  it("applies an explicit fixed discount object", () => {
    const result = calculateBookingPricing({ sellingPrice: 1000, discount: { type: "fixed", value: 75 } });
    assert.equal(result.discountAmount, 75);
  });

  it("never lets discount push discountedSellingPrice below 0, even if discount exceeds sellingPrice", () => {
    const result = calculateBookingPricing({ sellingPrice: 100, discount: 500 });
    assert.equal(result.discountAmount, 100);
    assert.equal(result.discountedSellingPrice, 0);
  });
});

describe("calculateBookingPricing — service charge, tax, and VAT", () => {
  it("applies service charge on the discounted selling price", () => {
    const result = calculateBookingPricing({ sellingPrice: 1000, discount: 100, serviceCharge: { type: "percentage", value: 5 } });
    // discountedSellingPrice = 900; serviceCharge = 5% of 900 = 45
    assert.equal(result.discountedSellingPrice, 900);
    assert.equal(result.serviceChargeAmount, 45);
  });

  it("applies tax and VAT on (discountedSellingPrice + serviceCharge), independently — not compounded on each other", () => {
    const result = calculateBookingPricing({
      sellingPrice: 1000,
      serviceCharge: 0,
      tax: { type: "percentage", value: 5 },
      vat: { type: "percentage", value: 15 },
    });
    // base = 1000; tax = 50; vat = 150 (both computed off the same 1000 base, not off each other)
    assert.equal(result.taxAmount, 50);
    assert.equal(result.vatAmount, 150);
    assert.equal(result.netAmount, 1200);
  });

  it("supports fixed-amount tax and VAT", () => {
    const result = calculateBookingPricing({ sellingPrice: 1000, tax: 20, vat: 40 });
    assert.equal(result.taxAmount, 20);
    assert.equal(result.vatAmount, 40);
    assert.equal(result.netAmount, 1060);
  });
});

describe("calculateBookingPricing — agent commission", () => {
  it("computes commission on the discounted selling price, not on tax/VAT/service charge", () => {
    const result = calculateBookingPricing({
      sellingPrice: 1000,
      discount: 100, // -> discountedSellingPrice 900
      serviceCharge: 100,
      tax: 50,
      vat: 50,
      agentCommissionRate: 10,
    });
    assert.equal(result.agentCommissionAmount, 90); // 10% of 900, not of 1100 netAmount
  });

  it("clamps a commission rate above 100 down to 100", () => {
    const result = calculateBookingPricing({ sellingPrice: 1000, agentCommissionRate: 250 });
    assert.equal(result.agentCommissionRate, 100);
    assert.equal(result.agentCommissionAmount, 1000);
  });
});

describe("calculateBookingPricing — profit and profit margin", () => {
  it("includes serviceCharge as agency revenue but excludes tax/VAT (pass-through)", () => {
    const result = calculateBookingPricing({
      buyingPrice: 500,
      sellingPrice: 1000,
      serviceCharge: 100,
      tax: 200,
      vat: 150,
      agentCommissionRate: 0,
    });
    // agencyRevenue = discountedSellingPrice(1000) + serviceCharge(100) = 1100
    // profit = 1100 - buyingPrice(500) - commission(0) = 600
    assert.equal(result.profit, 600);
    assert.equal(result.profitMargin, Math.round((600 / 1100) * 100 * 100) / 100);
  });

  it("returns profitMargin 0 when agency revenue is 0, without dividing by zero", () => {
    const result = calculateBookingPricing({ buyingPrice: 0, sellingPrice: 0 });
    assert.equal(result.profitMargin, 0);
  });

  it("can produce a negative profit when buyingPrice + commission exceed agency revenue", () => {
    const result = calculateBookingPricing({ buyingPrice: 900, sellingPrice: 1000, agentCommissionRate: 20 });
    // agencyRevenue = 1000; commission = 200; profit = 1000 - 900 - 200 = -100
    assert.equal(result.profit, -100);
  });
});

describe("calculateBookingPricing — due, balance, and rounding", () => {
  it("computes dueAmount as netAmount minus paidAmount, matching Invoice's own convention", () => {
    const result = calculateBookingPricing({ sellingPrice: 1000, paidAmount: 400 });
    assert.equal(result.dueAmount, 600);
    assert.equal(result.balance, 600);
  });

  it("does NOT clamp dueAmount/balance at 0 — a negative value signals an overpayment", () => {
    const result = calculateBookingPricing({ sellingPrice: 1000, paidAmount: 1500 });
    assert.equal(result.dueAmount, -500);
    assert.equal(result.balance, -500);
  });

  it("rounds every money field to 2 decimal places, including tricky floating-point cases", () => {
    const result = calculateBookingPricing({ sellingPrice: 100, discount: { type: "percentage", value: 33.333 } });
    assert.equal(result.discountAmount, 33.33);
    assert.equal(result.discountedSellingPrice, 66.67);
    // 0.1 + 0.2 style floating point traps should not leak through:
    const tricky = calculateBookingPricing({ sellingPrice: 0.1, serviceCharge: 0.2 });
    assert.equal(tricky.netAmount, 0.3);
  });
});

describe("validatePricing", () => {
  it("accepts a minimal valid input (sellingPrice only)", () => {
    assert.deepEqual(validatePricing({ sellingPrice: 500 }), { valid: true, errors: [] });
  });

  it("requires sellingPrice", () => {
    const result = validatePricing({});
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("sellingPrice")));
  });

  it("rejects a negative buyingPrice/sellingPrice/paidAmount", () => {
    assert.equal(validatePricing({ sellingPrice: 100, buyingPrice: -1 }).valid, false);
    assert.equal(validatePricing({ sellingPrice: -1 }).valid, false);
    assert.equal(validatePricing({ sellingPrice: 100, paidAmount: -1 }).valid, false);
  });

  it("rejects a charge object with an invalid type", () => {
    const result = validatePricing({ sellingPrice: 100, tax: { type: "weird", value: 5 } });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("tax.type")));
  });

  it("rejects a percentage charge value above 100", () => {
    const result = validatePricing({ sellingPrice: 100, vat: { type: "percentage", value: 150 } });
    assert.equal(result.valid, false);
  });

  it("rejects a fixed discount that exceeds sellingPrice", () => {
    assert.equal(validatePricing({ sellingPrice: 100, discount: 500 }).valid, false);
    assert.equal(validatePricing({ sellingPrice: 100, discount: { type: "fixed", value: 500 } }).valid, false);
  });

  it("allows a percentage discount even if nominally 'over 100% of the fixed value semantics' (percentage cap is checked separately)", () => {
    assert.equal(validatePricing({ sellingPrice: 100, discount: { type: "percentage", value: 50 } }).valid, true);
  });

  it("rejects an agentCommissionRate outside 0-100", () => {
    assert.equal(validatePricing({ sellingPrice: 100, agentCommissionRate: -5 }).valid, false);
    assert.equal(validatePricing({ sellingPrice: 100, agentCommissionRate: 150 }).valid, false);
    assert.equal(validatePricing({ sellingPrice: 100, agentCommissionRate: 10 }).valid, true);
  });

  it("accepts a fully populated, valid, complex input", () => {
    const result = validatePricing({
      buyingPrice: 700,
      sellingPrice: 1000,
      discount: { type: "percentage", value: 10 },
      serviceCharge: { type: "fixed", value: 50 },
      tax: { type: "percentage", value: 5 },
      vat: { type: "percentage", value: 15 },
      agentCommissionRate: 10,
      paidAmount: 500,
    });
    assert.deepEqual(result, { valid: true, errors: [] });
  });
});

describe("pricingSummary — composes validatePricing + calculateBookingPricing, never re-implements them", () => {
  it("nests the exact same pricing object calculateBookingPricing would produce", () => {
    const input = { buyingPrice: 700, sellingPrice: 1000, paidAmount: 300 };
    const summary = pricingSummary(input);
    assert.deepEqual(summary.pricing, calculateBookingPricing(input));
  });

  it("surfaces validatePricing's exact errors when input is invalid", () => {
    const summary = pricingSummary({ sellingPrice: -1 });
    assert.equal(summary.valid, false);
    assert.deepEqual(summary.errors, validatePricing({ sellingPrice: -1 }).errors);
  });

  it("derives paymentStatus: unpaid, partial, paid, and overpaid", () => {
    assert.equal(pricingSummary({ sellingPrice: 1000, paidAmount: 0 }).paymentStatus, "unpaid");
    assert.equal(pricingSummary({ sellingPrice: 1000, paidAmount: 400 }).paymentStatus, "partial");
    assert.equal(pricingSummary({ sellingPrice: 1000, paidAmount: 1000 }).paymentStatus, "paid");
    assert.equal(pricingSummary({ sellingPrice: 1000, paidAmount: 1200 }).paymentStatus, "overpaid");
  });

  it("treats a free (netAmount 0) booking with no payment as 'paid', not 'unpaid'", () => {
    assert.equal(pricingSummary({ sellingPrice: 100, discount: 100, paidAmount: 0 }).paymentStatus, "paid");
  });
});
