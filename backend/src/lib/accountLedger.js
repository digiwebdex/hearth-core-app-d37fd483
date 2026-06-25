const ACCOUNT_WRITABLE_KEYS = new Set([
  "name", "type", "balance", "accountNumber", "bankName", "notes", "status",
]);

function pickAccountData(body) {
  const data = {};
  for (const key of ACCOUNT_WRITABLE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined) {
      data[key] = body[key];
    }
  }
  return data;
}

function normalizeOptionalId(value) {
  const next = String(value || "").trim();
  if (!next || next === "none") return null;
  return next;
}

async function adjustAccountBalance(prisma, accountId, tenantId, delta) {
  const amount = Number(delta) || 0;
  if (!accountId || !amount) return;
  const account = await prisma.account.findFirst({
    where: { id: accountId, tenantId, status: "active" },
    select: { id: true },
  });
  if (!account) return;
  await prisma.account.update({
    where: { id: account.id },
    data: { balance: { increment: amount } },
  });
}

async function hydrateLedgerTransactions(prisma, tenantId, rows = []) {
  if (!rows.length) return [];

  const accountIds = [...new Set(rows.map((r) => r.accountId).filter(Boolean))];
  const bookingIds = [...new Set(rows.map((r) => r.bookingId).filter(Boolean))];
  const vendorIds = [...new Set(rows.map((r) => r.vendorId).filter(Boolean))];
  const clientIds = [...new Set(rows.map((r) => r.clientId).filter(Boolean))];
  const invoiceIds = [...new Set(rows.map((r) => r.invoiceId).filter(Boolean))];

  const [accounts, bookings, vendors, clients, invoices] = await Promise.all([
    accountIds.length
      ? prisma.account.findMany({ where: { id: { in: accountIds }, tenantId }, select: { id: true, name: true } })
      : [],
    bookingIds.length
      ? prisma.booking.findMany({ where: { id: { in: bookingIds }, tenantId }, select: { id: true, title: true, destination: true, clientId: true, client: { select: { name: true } } } })
      : [],
    vendorIds.length
      ? prisma.vendor.findMany({ where: { id: { in: vendorIds }, tenantId }, select: { id: true, name: true } })
      : [],
    clientIds.length
      ? prisma.client.findMany({ where: { id: { in: clientIds }, tenantId }, select: { id: true, name: true } })
      : [],
    invoiceIds.length
      ? prisma.invoice.findMany({ where: { id: { in: invoiceIds }, tenantId }, select: { id: true, invoiceNumber: true } })
      : [],
  ]);

  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
  const bookingMap = new Map(bookings.map((b) => [b.id, b]));
  const vendorMap = new Map(vendors.map((v) => [v.id, v.name]));
  const clientMap = new Map(clients.map((c) => [c.id, c.name]));
  const invoiceMap = new Map(invoices.map((i) => [i.id, i.invoiceNumber]));

  return rows.map((row) => {
    const booking = row.bookingId ? bookingMap.get(row.bookingId) : null;
    return {
      ...row,
      accountName: row.accountId ? accountMap.get(row.accountId) || "" : "",
      vendorName: row.vendorId ? vendorMap.get(row.vendorId) || "" : "",
      clientName: row.clientId
        ? clientMap.get(row.clientId) || ""
        : booking?.client?.name || "",
      bookingTitle: booking?.title || booking?.destination || "",
      invoiceNumber: row.invoiceId ? invoiceMap.get(row.invoiceId) || "" : "",
    };
  });
}

async function hydratePayments(prisma, tenantId, payments = []) {
  if (!payments.length) return [];
  const userIds = [...new Set(payments.map((p) => p.receivedBy).filter(Boolean))];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds }, tenantId }, select: { id: true, name: true } })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  return payments.map((payment) => ({
    ...payment,
    receivedByName: payment.receivedBy ? userMap.get(payment.receivedBy) || "" : "",
  }));
}

module.exports = {
  pickAccountData,
  normalizeOptionalId,
  adjustAccountBalance,
  hydrateLedgerTransactions,
  hydratePayments,
};
