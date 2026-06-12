require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { enrichQuotationFromPackage } = require("../src/services/packageLinkage");

describe("packageLinkage", () => {
  it("returns body unchanged when packageId is missing", async () => {
    const body = { title: "Quote only" };
    const result = await enrichQuotationFromPackage(body, "tenant-1");
    assert.equal(result.title, "Quote only");
  });
});
