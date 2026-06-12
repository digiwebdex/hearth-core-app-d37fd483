const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  flattenServiceDetails,
  buildListWhere,
  pickServiceDetailsPayload,
} = require("../src/lib/bookingServiceDetails");

describe("bookingServiceDetails", () => {
  it("flattens serviceDetails onto booking for API consumers", () => {
    const result = flattenServiceDetails({
      id: "b1",
      type: "visa",
      serviceDetails: { visaCountry: "UAE", passportNumber: "AB123" },
      opsStatus: "pending",
    });
    assert.equal(result.visaCountry, "UAE");
    assert.equal(result.passportNumber, "AB123");
    assert.deepEqual(result.serviceDetails, { visaCountry: "UAE", passportNumber: "AB123" });
  });

  it("builds list filters for type and opsStatus", () => {
    const where = buildListWhere("tenant-1", { type: "visa", opsStatus: "submitted" });
    assert.equal(where.tenantId, "tenant-1");
    assert.equal(where.type, "visa");
    assert.equal(where.opsStatus, "submitted");
  });

  it("moves non-scalar payload fields into serviceDetails", () => {
    const next = pickServiceDetailsPayload({
      type: "ticket",
      title: "DXB flight",
      pnrNumber: "ABC123",
      airline: "Emirates",
      opsStatus: "pending",
    });
    assert.equal(next.type, "ticket");
    assert.equal(next.title, "DXB flight");
    assert.equal(next.opsStatus, "pending");
    assert.equal(next.serviceDetails.pnrNumber, "ABC123");
    assert.equal(next.serviceDetails.airline, "Emirates");
    assert.equal(next.pnrNumber, undefined);
  });
});
