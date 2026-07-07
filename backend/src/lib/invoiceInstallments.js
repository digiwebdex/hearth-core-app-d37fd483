function installmentStatus(amount, paidAmount) {
  if (paidAmount >= amount) return "paid";
  if (paidAmount > 0) return "partial";
  return "pending";
}

async function allocatePaymentToInstallments(prisma, invoiceId, tenantId, paymentAmount) {
  if (!paymentAmount || paymentAmount <= 0) return;

  const installments = await prisma.invoiceInstallment.findMany({
    where: { invoiceId, tenantId },
    orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  let remaining = paymentAmount;
  for (const row of installments) {
    if (remaining <= 0) break;
    const owed = Math.max(0, Number(row.amount) - Number(row.paidAmount));
    if (owed <= 0) continue;
    const apply = Math.min(remaining, owed);
    const paidAmount = Math.round((Number(row.paidAmount) + apply) * 100) / 100;
    await prisma.invoiceInstallment.update({
      where: { id: row.id },
      data: {
        paidAmount,
        status: installmentStatus(Number(row.amount), paidAmount),
      },
    });
    remaining = Math.round((remaining - apply) * 100) / 100;
  }
}

async function ensureLedgerIncomeTransaction(prisma, { payment, invoice, tenantId, bookingId }) {
  const existing = await prisma.transaction.findFirst({
    where: {
      tenantId,
      referenceType: "payment",
      referenceId: payment.id,
    },
  });
  if (existing) return existing;

  return prisma.transaction.create({
    data: {
      type: "income",
      category: "invoice_payment",
      description: `Payment received for ${invoice.invoiceNumber || invoice.id} via ${payment.method}`,
      amount: payment.amount,
      referenceId: payment.id,
      referenceType: "payment",
      invoiceId: invoice.id,
      bookingId: bookingId || null,
      paymentMethod: payment.method,
      status: "completed",
      date: payment.date || new Date().toISOString().slice(0, 10),
      tenantId,
    },
  }).catch(() => null);
}

// Reset all of an invoice's installment allocations and re-apply a total paid
// amount from scratch — used when a payment is deleted (reverses the running
// allocation instead of leaving installments over-paid).
async function reallocateInstallments(prisma, invoiceId, tenantId, totalPaid) {
  await prisma.invoiceInstallment.updateMany({
    where: { invoiceId, tenantId },
    data: { paidAmount: 0, status: "pending" },
  });
  await allocatePaymentToInstallments(prisma, invoiceId, tenantId, totalPaid);
}

module.exports = {
  installmentStatus,
  allocatePaymentToInstallments,
  reallocateInstallments,
  ensureLedgerIncomeTransaction,
};
