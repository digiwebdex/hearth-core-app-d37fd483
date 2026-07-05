require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-at-least-32-characters-long";
process.env.RATE_LIMIT_DISABLED = "true";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  SUPPLIER_CATEGORIES,
  getSupplierCategoryLabel,
  summarizePayables,
  resolveSupplierContext,
} = require("../src/lib/supplierEngine");

const APPROVED_CATEGORY_VALUES = ["airline", "hotel", "visa_partner", "tour_operator", "transport", "guide", "insurance", "other"];

describe("supplierEngine — SUPPLIER_CATEGORIES (pure, no database)", () => {
  it("supports exactly the 7 approved supplier subtypes plus 'other'", () => {
    assert.deepEqual(SUPPLIER_CATEGORIES.map((c) => c.value).sort(), [...APPROVED_CATEGORY_VALUES].sort());
  });

  it("labels every approved category, including the new Insurance Company one", () => {
    assert.equal(getSupplierCategoryLabel("airline"), "Airline");
    assert.equal(getSupplierCategoryLabel("hotel"), "Hotel Partner");
    assert.equal(getSupplierCategoryLabel("visa_partner"), "Visa Partner");
    assert.equal(getSupplierCategoryLabel("tour_operator"), "Tour Operator");
    assert.equal(getSupplierCategoryLabel("transport"), "Transport Provider");
    assert.equal(getSupplierCategoryLabel("guide"), "Guide");
    assert.equal(getSupplierCategoryLabel("insurance"), "Insurance Company");
  });

  it("falls back to the raw value for an unrecognized category, rather than throwing", () => {
    assert.equal(getSupplierCategoryLabel("something-new"), "something-new");
  });
});

describe("supplierEngine — summarizePayables (pure, no database)", () => {
  it("totals billed/paid/due and buckets bills by status", () => {
    const bills = [
      { totalAmount: 10000, paidAmount: 10000, dueAmount: 0, status: "paid" },
      { totalAmount: 5000, paidAmount: 2000, dueAmount: 3000, status: "partial" },
      { totalAmount: 8000, paidAmount: 0, dueAmount: 8000, status: "unpaid" },
      { totalAmount: 2000, paidAmount: 0, dueAmount: 2000, status: "overdue" },
    ];
    assert.deepEqual(summarizePayables(bills), {
      billCount: 4,
      totalBilled: 25000,
      totalPaid: 12000,
      totalDue: 13000,
      byStatus: { unpaid: 1, partial: 1, paid: 1, overdue: 1 },
    });
  });

  it("handles a supplier with no bills", () => {
    assert.deepEqual(summarizePayables([]), {
      billCount: 0,
      totalBilled: 0,
      totalPaid: 0,
      totalDue: 0,
      byStatus: { unpaid: 0, partial: 0, paid: 0, overdue: 0 },
    });
  });
});

describe("supplierEngine — resolveSupplierContext fails safe on bad input, fails loud on real reads", () => {
  it("returns null immediately for a missing vendorId or tenantId (no database touched)", async () => {
    assert.equal(await resolveSupplierContext(null, "t1"), null);
    assert.equal(await resolveSupplierContext("v1", null), null);
  });

  it("propagates a real read failure rather than returning fabricated data (no DATABASE_URL in this test environment)", async () => {
    await assert.rejects(() => resolveSupplierContext("some-vendor-id", "some-tenant-id"));
  });
});
