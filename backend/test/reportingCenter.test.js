require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-at-least-32-characters-long";
process.env.RATE_LIMIT_DISABLED = "true";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../src/app");
const {
  parseReportFilters,
  inDateRange,
  summarizeBookings,
  serviceWiseSummary,
  topEntities,
  monthlyTrend,
  REPORT_REGISTRY,
  getReport,
  dataset,
  EXPORT_FORMATS,
  toCSV,
  toHTML,
} = require("../src/lib/reportingCenter");

describe("reportingCenter — parseReportFilters (pure)", () => {
  it("parses all supported filters and aliases", () => {
    const f = parseReportFilters({ from: "2026-01-01", to: "2026-12-31", serviceType: "visa", agentId: "a1", clientId: "c1", vendorId: "v1", branchId: "b1" });
    assert.equal(f.from, "2026-01-01");
    assert.equal(f.to, "2026-12-31");
    assert.equal(f.serviceType, "visa");
    assert.equal(f.agentId, "a1");
    assert.equal(f.customerId, "c1"); // clientId alias
    assert.equal(f.supplierId, "v1"); // vendorId alias
    assert.equal(f.branchId, "b1"); // reserved, still parsed
  });

  it("defaults everything to null", () => {
    const f = parseReportFilters({});
    for (const v of Object.values(f)) assert.equal(v, null);
  });
});

describe("reportingCenter — inDateRange (pure)", () => {
  it("handles Date and string values with open/closed bounds", () => {
    assert.equal(inDateRange("2026-06-15", "2026-06-01", "2026-06-30"), true);
    assert.equal(inDateRange("2026-07-01", "2026-06-01", "2026-06-30"), false);
    assert.equal(inDateRange(new Date("2026-06-15T10:00:00Z"), "2026-06-01", null), true);
    assert.equal(inDateRange(null, "2026-06-01", "2026-06-30"), false);
  });
});

describe("reportingCenter — summarizeBookings (pure)", () => {
  it("totals amount/cost/profit/paid/due", () => {
    const s = summarizeBookings([
      { amount: 1000, cost: 700, profit: 300, paidAmount: 400, dueAmount: 600 },
      { amount: 500, cost: 300, profit: 200, paidAmount: 500, dueAmount: 0 },
    ]);
    assert.deepEqual(s, { count: 2, amount: 1500, cost: 1000, profit: 500, paid: 900, due: 600 });
  });
});

describe("reportingCenter — serviceWiseSummary (pure)", () => {
  it("groups by serviceType, sorted by revenue", () => {
    const rows = serviceWiseSummary([
      { serviceType: "visa", amount: 200, profit: 50 },
      { serviceType: "air_ticket", amount: 1000, profit: 100 },
      { serviceType: "visa", amount: 300, profit: 70 },
    ]);
    assert.equal(rows[0].serviceType, "air_ticket");
    assert.equal(rows[1].serviceType, "visa");
    assert.equal(rows[1].count, 2);
    assert.equal(rows[1].amount, 500);
  });
});

describe("reportingCenter — topEntities (pure)", () => {
  it("aggregates + sorts descending + skips falsy ids + caps at n", () => {
    const rows = [
      { cid: "c1", name: "A", val: 100 },
      { cid: "c1", name: "A", val: 50 },
      { cid: "c2", name: "B", val: 200 },
      { cid: null, name: "X", val: 999 },
    ];
    const top = topEntities(rows, (r) => r.cid, (r) => r.name, (r) => r.val, 10);
    assert.equal(top.length, 2);
    assert.deepEqual(top[0], { id: "c2", label: "B", value: 200, count: 1 });
    assert.deepEqual(top[1], { id: "c1", label: "A", value: 150, count: 2 });
  });
});

describe("reportingCenter — monthlyTrend (pure)", () => {
  it("buckets by YYYY-MM chronologically", () => {
    const trend = monthlyTrend(
      [{ d: "2026-02-01", v: 200 }, { d: "2026-01-15", v: 100 }, { d: "2026-01-20", v: 50 }],
      (r) => r.d,
      (r) => r.v,
    );
    assert.deepEqual(trend, [
      { month: "2026-01", value: 150, count: 2 },
      { month: "2026-02", value: 200, count: 1 },
    ]);
  });
});

describe("reportingCenter — report registry", () => {
  it("registers exactly the 17 requested reports", () => {
    assert.deepEqual(
      REPORT_REGISTRY.map((r) => r.id).sort(),
      ["booking", "customer", "agent", "supplier", "payment", "invoice", "profit_loss", "cash_book", "bank_book", "commission", "due", "service_wise", "air_ticket", "visa", "hotel", "hajj_umrah", "tour"].sort(),
    );
  });

  it("the per-service reports carry the right Booking.type", () => {
    assert.equal(getReport("air_ticket").bookingType, "ticket");
    assert.equal(getReport("visa").bookingType, "visa");
    assert.equal(getReport("hotel").bookingType, "hotel");
    assert.equal(getReport("hajj_umrah").bookingType, "hajj");
    assert.equal(getReport("tour").bookingType, "tour");
  });
});

describe("reportingCenter — export serializers (pure)", () => {
  const ds = dataset(
    [{ key: "name", label: "Name" }, { key: "amount", label: "Amount" }],
    [{ name: "Simple", amount: 100 }, { name: 'Has, comma "and" quote', amount: 250 }],
  );

  it("supports csv, xlsx, html formats", () => {
    assert.deepEqual([...EXPORT_FORMATS].sort(), ["csv", "html", "xlsx"]);
  });

  it("toCSV writes a header row and escapes commas/quotes", () => {
    const csv = toCSV(ds);
    const lines = csv.split("\n");
    assert.equal(lines[0], "Name,Amount");
    assert.equal(lines[1], "Simple,100");
    assert.equal(lines[2], '"Has, comma ""and"" quote",250'); // quoted + doubled quotes
  });

  it("toHTML builds a table and escapes HTML", () => {
    const html = toHTML(dataset([{ key: "v", label: "Value" }], [{ v: "<script>x</script>" }]), "My Report");
    assert.match(html, /<th>Value<\/th>/);
    assert.match(html, /&lt;script&gt;x&lt;\/script&gt;/);
    assert.match(html, /<h2>My Report<\/h2>/);
    assert.doesNotMatch(html, /<script>/);
  });
});

describe("/api/reporting — authentication required on every endpoint", () => {
  const app = createApp();
  const endpoints = [
    ["get", "/api/reporting/dashboard"],
    ["get", "/api/reporting/reports"],
    ["get", "/api/reporting/reports/booking"],
    ["get", "/api/reporting/reports/booking/export?format=csv"],
    ["get", "/api/reporting/analytics/top-customers"],
    ["get", "/api/reporting/analytics/top-agents"],
    ["get", "/api/reporting/analytics/top-suppliers"],
    ["get", "/api/reporting/analytics/top-services"],
    ["get", "/api/reporting/analytics/trends"],
  ];
  for (const [method, path] of endpoints) {
    it(`401 without a token: ${method.toUpperCase()} ${path}`, async () => {
      const res = await request(app)[method](path);
      assert.equal(res.status, 401);
      assert.match(res.body.message, /token/i);
    });
  }
});
