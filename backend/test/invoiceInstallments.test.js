const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  installmentStatus,
  allocatePaymentToInstallments,
} = require("../src/lib/invoiceInstallments");

describe("invoiceInstallments", () => {
  it("derives installment status from amounts", () => {
    assert.equal(installmentStatus(1000, 0), "pending");
    assert.equal(installmentStatus(1000, 400), "partial");
    assert.equal(installmentStatus(1000, 1000), "paid");
  });

  it("allocates payment to oldest due installments first", async () => {
    const updates = [];
    const prisma = {
      invoiceInstallment: {
        findMany: async () => [
          { id: "a", amount: 500, paidAmount: 0, dueDate: "2026-06-01" },
          { id: "b", amount: 500, paidAmount: 0, dueDate: "2026-07-01" },
        ],
        update: async ({ where, data }) => {
          updates.push({ id: where.id, ...data });
          return { id: where.id, ...data };
        },
      },
    };

    await allocatePaymentToInstallments(prisma, "inv-1", "tenant-1", 700);
    assert.equal(updates.length, 2);
    assert.equal(updates[0].id, "a");
    assert.equal(updates[0].paidAmount, 500);
    assert.equal(updates[0].status, "paid");
    assert.equal(updates[1].id, "b");
    assert.equal(updates[1].paidAmount, 200);
    assert.equal(updates[1].status, "partial");
  });
});
