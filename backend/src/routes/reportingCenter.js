// Reporting & Analytics Center — dashboard KPIs, 17 business reports, 7
// analytics, and CSV/Excel/HTML export.
// (docs/v2-master/11-Architecture-Freeze.md, docs/v2-master/12-Implementation-Sequence.md).
//
// Read-only, additive. Mounted at /api/reporting. "No duplicate business
// logic": the finance KPIs/reports reuse Finance Core's pure builders
// (buildBookLedger for cash/bank/bKash/Nagad balances, buildAging for
// receivable/payable/due) rather than re-implementing them; booking
// aggregation reuses reportingCenter.js's pure helpers. The existing
// /api/finance, /api/accounts, /api/dashboard, /api/crm-analytics reports are
// untouched — this is a unified reporting surface on top of the same data.
// Excel export reuses the existing `exceljs` dependency; PDF is delivered as
// print-ready HTML (no new dependency).

const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");
const { buildBookLedger, buildAging } = require("../lib/financeCore");
const {
  parseReportFilters,
  summarizeBookings,
  serviceWiseSummary,
  topEntities,
  monthlyTrend,
  getReportRegistry,
  getReport,
  dataset,
  EXPORT_FORMATS,
  toCSV,
  toHTML,
} = require("../lib/reportingCenter");

router.use(authenticate);

function isoDay(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : (value ? String(value).slice(0, 10) : null);
}
function dateRangeWhere(from, to) {
  const r = {};
  if (from) r.gte = new Date(from);
  if (to) { const end = new Date(to); end.setHours(23, 59, 59, 999); r.lte = end; }
  return Object.keys(r).length ? r : undefined;
}
function bookingWhere(tenantId, filters, bookingType) {
  const where = { tenantId };
  const type = bookingType || filters.bookingType;
  if (type) where.type = type;
  if (filters.serviceType) where.serviceType = filters.serviceType;
  if (filters.agentId) where.agentId = filters.agentId;
  if (filters.customerId) where.clientId = filters.customerId;
  const createdAt = dateRangeWhere(filters.from, filters.to);
  if (createdAt) where.createdAt = createdAt;
  return where;
}
async function fetchBookings(tenantId, filters, bookingType) {
  return prisma.booking.findMany({
    where: bookingWhere(tenantId, filters, bookingType),
    select: {
      id: true, type: true, serviceType: true, title: true, destination: true, status: true, paymentStatus: true,
      amount: true, cost: true, profit: true, paidAmount: true, dueAmount: true, createdAt: true,
      clientId: true, agentId: true,
      client: { select: { id: true, name: true } },
      agent: { select: { id: true, name: true } },
      agentCommission: { select: { agentCommissionAmount: true, agentCommissionStatus: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
function mapBookingRow(b) {
  return {
    date: isoDay(b.createdAt),
    type: b.type,
    serviceType: b.serviceType || b.type,
    title: b.title || b.destination || "",
    client: b.client?.name || "",
    agent: b.agent?.name || "",
    amount: b.amount, cost: b.cost, profit: b.profit, paidAmount: b.paidAmount, dueAmount: b.dueAmount,
    status: b.status,
  };
}

// ── Dashboard (13 KPIs) ──
router.get("/dashboard", requirePermission("reports", "view"), async (req, res) => {
  try {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const monthStr = todayStr.slice(0, 7);
    const monthStart = new Date(`${monthStr}-01T00:00:00.000Z`);

    const [monthBookings, transactions, dueInvoices, duePayables] = await Promise.all([
      prisma.booking.findMany({
        where: { tenantId: req.tenantId, createdAt: { gte: monthStart } },
        select: { amount: true, profit: true, paidAmount: true, dueAmount: true, createdAt: true },
      }),
      prisma.transaction.findMany({
        where: { tenantId: req.tenantId, status: "completed" },
        select: { date: true, type: true, amount: true, paymentMethod: true },
      }),
      prisma.invoice.findMany({ where: { tenantId: req.tenantId, dueAmount: { gt: 0 } }, select: { dueAmount: true, dueDate: true } }),
      prisma.vendorBill.findMany({ where: { tenantId: req.tenantId, dueAmount: { gt: 0 } }, select: { dueAmount: true, dueDate: true } }),
    ]);

    const todayBookings = monthBookings.filter((b) => isoDay(b.createdAt) === todayStr);
    const sum = (rows, key) => Math.round(rows.reduce((s, r) => s + (Number(r[key]) || 0), 0) * 100) / 100;

    const entries = transactions.map((t) => ({ date: t.date, type: t.type, amount: t.amount, method: t.paymentMethod }));
    const income = entries.filter((e) => e.type === "income");
    const expense = entries.filter((e) => e.type === "expense");
    const inMonth = (e) => String(e.date || "").slice(0, 7) === monthStr;
    const isToday = (e) => String(e.date || "").slice(0, 10) === todayStr;
    const sumBy = (rows, pred) => Math.round(rows.filter(pred).reduce((s, e) => s + (Number(e.amount) || 0), 0) * 100) / 100;

    res.json({
      todaySales: sum(todayBookings, "amount"),
      todayCollection: sumBy(income, isToday),
      todayDue: sum(todayBookings, "dueAmount"),
      monthlySales: sum(monthBookings, "amount"),
      monthlyCollection: sumBy(income, inMonth),
      monthlyProfit: sum(monthBookings, "profit"),
      monthlyExpense: sumBy(expense, inMonth),
      cashBalance: buildBookLedger(entries, "cash").balance,
      bankBalance: buildBookLedger(entries, "bank").balance,
      bkashBalance: buildBookLedger(entries, "bkash").balance,
      nagadBalance: buildBookLedger(entries, "nagad").balance,
      accountsReceivable: buildAging(dueInvoices.map((i) => ({ amount: i.dueAmount, dueDate: isoDay(i.dueDate) })), todayStr).total,
      accountsPayable: buildAging(duePayables.map((b) => ({ amount: b.dueAmount, dueDate: isoDay(b.dueDate) })), todayStr).total,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Report registry ──
router.get("/reports", requirePermission("reports", "view"), (_req, res) => {
  res.json({ reports: getReportRegistry() });
});

// ── The report builder dispatcher (all 17) ──
async function buildReport(reportId, tenantId, filters) {
  const report = getReport(reportId);
  if (!report) return null;

  // Booking-list reports (booking + the five per-service ones share this shape).
  if (reportId === "booking" || report.bookingType) {
    const bookings = await fetchBookings(tenantId, filters, report.bookingType);
    return dataset(
      [
        { key: "date", label: "Date" }, { key: "type", label: "Type" }, { key: "title", label: "Title" },
        { key: "client", label: "Customer" }, { key: "agent", label: "Agent" },
        { key: "amount", label: "Amount" }, { key: "cost", label: "Cost" }, { key: "profit", label: "Profit" },
        { key: "paidAmount", label: "Paid" }, { key: "dueAmount", label: "Due" }, { key: "status", label: "Status" },
      ],
      bookings.map(mapBookingRow),
      { summary: summarizeBookings(bookings) },
    );
  }

  if (reportId === "service_wise") {
    const bookings = await fetchBookings(tenantId, filters);
    return dataset(
      [{ key: "serviceType", label: "Service Type" }, { key: "count", label: "Bookings" }, { key: "amount", label: "Revenue" }, { key: "profit", label: "Profit" }],
      serviceWiseSummary(bookings),
      { summary: summarizeBookings(bookings) },
    );
  }

  if (reportId === "customer") {
    const bookings = await fetchBookings(tenantId, filters);
    const map = new Map();
    for (const b of bookings) {
      if (!b.clientId) continue;
      const row = map.get(b.clientId) || { customer: b.client?.name || "", bookings: 0, amount: 0, due: 0 };
      row.bookings += 1; row.amount = Math.round((row.amount + (Number(b.amount) || 0)) * 100) / 100; row.due = Math.round((row.due + (Number(b.dueAmount) || 0)) * 100) / 100;
      map.set(b.clientId, row);
    }
    return dataset(
      [{ key: "customer", label: "Customer" }, { key: "bookings", label: "Bookings" }, { key: "amount", label: "Total Amount" }, { key: "due", label: "Due" }],
      [...map.values()].sort((a, b) => b.amount - a.amount),
    );
  }

  if (reportId === "agent" || reportId === "commission") {
    const bookings = await fetchBookings(tenantId, filters);
    if (reportId === "commission") {
      const rows = bookings
        .filter((b) => b.agentCommission)
        .map((b) => ({ agent: b.agent?.name || "", booking: b.title || b.destination || b.id, commission: b.agentCommission.agentCommissionAmount ?? 0, status: b.agentCommission.agentCommissionStatus || "pending" }));
      return dataset(
        [{ key: "agent", label: "Agent" }, { key: "booking", label: "Booking" }, { key: "commission", label: "Commission" }, { key: "status", label: "Status" }],
        rows,
      );
    }
    const map = new Map();
    for (const b of bookings) {
      if (!b.agentId) continue;
      const row = map.get(b.agentId) || { agent: b.agent?.name || "", bookings: 0, amount: 0, commission: 0 };
      row.bookings += 1;
      row.amount = Math.round((row.amount + (Number(b.amount) || 0)) * 100) / 100;
      row.commission = Math.round((row.commission + (Number(b.agentCommission?.agentCommissionAmount) || 0)) * 100) / 100;
      map.set(b.agentId, row);
    }
    return dataset(
      [{ key: "agent", label: "Agent" }, { key: "bookings", label: "Bookings" }, { key: "amount", label: "Booked Amount" }, { key: "commission", label: "Commission" }],
      [...map.values()].sort((a, b) => b.commission - a.commission),
    );
  }

  if (reportId === "supplier") {
    const bills = await prisma.vendorBill.findMany({
      where: { tenantId, ...(filters.supplierId ? { vendorId: filters.supplierId } : {}) },
      select: { vendorId: true, totalAmount: true, dueAmount: true, vendor: { select: { name: true } } },
    });
    const map = new Map();
    for (const bill of bills) {
      const row = map.get(bill.vendorId) || { supplier: bill.vendor?.name || "", bills: 0, billed: 0, due: 0 };
      row.bills += 1; row.billed = Math.round((row.billed + (Number(bill.totalAmount) || 0)) * 100) / 100; row.due = Math.round((row.due + (Number(bill.dueAmount) || 0)) * 100) / 100;
      map.set(bill.vendorId, row);
    }
    return dataset(
      [{ key: "supplier", label: "Supplier" }, { key: "bills", label: "Bills" }, { key: "billed", label: "Total Billed" }, { key: "due", label: "Payable" }],
      [...map.values()].sort((a, b) => b.due - a.due),
    );
  }

  if (reportId === "payment") {
    const payments = await prisma.payment.findMany({
      where: { tenantId, ...(filters.from || filters.to ? { date: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } : {}) },
      select: { id: true, date: true, method: true, amount: true, transactionRef: true, invoiceId: true },
      orderBy: { date: "desc" },
    });
    return dataset(
      [{ key: "date", label: "Date" }, { key: "method", label: "Method" }, { key: "amount", label: "Amount" }, { key: "transactionRef", label: "Reference" }],
      payments.map((p) => ({ date: isoDay(p.date), method: p.method, amount: p.amount, transactionRef: p.transactionRef || "" })),
      { total: Math.round(payments.reduce((s, p) => s + (Number(p.amount) || 0), 0) * 100) / 100 },
    );
  }

  if (reportId === "invoice") {
    const invoices = await prisma.invoice.findMany({
      where: { tenantId, ...(filters.customerId ? { clientId: filters.customerId } : {}), ...(dateRangeWhere(filters.from, filters.to) ? { createdAt: dateRangeWhere(filters.from, filters.to) } : {}) },
      select: { invoiceNumber: true, clientName: true, totalAmount: true, paidAmount: true, dueAmount: true, status: true, dueDate: true },
      orderBy: { createdAt: "desc" },
    });
    return dataset(
      [{ key: "invoiceNumber", label: "Invoice #" }, { key: "clientName", label: "Customer" }, { key: "totalAmount", label: "Total" }, { key: "paidAmount", label: "Paid" }, { key: "dueAmount", label: "Due" }, { key: "status", label: "Status" }, { key: "dueDate", label: "Due Date" }],
      invoices.map((i) => ({ ...i, dueDate: isoDay(i.dueDate) })),
    );
  }

  if (reportId === "due") {
    const invoices = await prisma.invoice.findMany({
      where: { tenantId, dueAmount: { gt: 0 } },
      select: { invoiceNumber: true, clientName: true, dueAmount: true, dueDate: true },
      orderBy: { dueDate: "asc" },
    });
    const aging = buildAging(invoices.map((i) => ({ amount: i.dueAmount, dueDate: isoDay(i.dueDate) })), new Date().toISOString().slice(0, 10));
    return dataset(
      [{ key: "invoiceNumber", label: "Invoice #" }, { key: "clientName", label: "Customer" }, { key: "dueAmount", label: "Due" }, { key: "dueDate", label: "Due Date" }],
      invoices.map((i) => ({ ...i, dueDate: isoDay(i.dueDate) })),
      { aging },
    );
  }

  if (reportId === "cash_book" || reportId === "bank_book") {
    const book = reportId === "cash_book" ? "cash" : "bank";
    const transactions = await prisma.transaction.findMany({
      where: { tenantId, status: "completed", ...(filters.from || filters.to ? { date: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } : {}) },
      select: { date: true, type: true, amount: true, description: true, paymentMethod: true, referenceId: true },
    });
    const ledger = buildBookLedger(transactions.map((t) => ({ date: t.date, type: t.type, amount: t.amount, method: t.paymentMethod, description: t.description, reference: t.referenceId })), book);
    return dataset(
      [{ key: "date", label: "Date" }, { key: "type", label: "Type" }, { key: "description", label: "Description" }, { key: "inflow", label: "In" }, { key: "outflow", label: "Out" }, { key: "balance", label: "Balance" }],
      ledger.lines,
      { totalIn: ledger.totalIn, totalOut: ledger.totalOut, balance: ledger.balance },
    );
  }

  if (reportId === "profit_loss") {
    const [bookings, expenses] = await Promise.all([
      fetchBookings(tenantId, filters),
      prisma.expense.findMany({ where: { tenantId, status: "approved", ...(dateRangeWhere(filters.from, filters.to) ? { createdAt: dateRangeWhere(filters.from, filters.to) } : {}) }, select: { amount: true } }),
    ]);
    const s = summarizeBookings(bookings);
    const totalExpense = Math.round(expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) * 100) / 100;
    const netProfit = Math.round((s.profit - totalExpense) * 100) / 100;
    return dataset(
      [{ key: "item", label: "Item" }, { key: "amount", label: "Amount" }],
      [
        { item: "Revenue", amount: s.amount },
        { item: "Cost of Sales", amount: s.cost },
        { item: "Gross Profit", amount: s.profit },
        { item: "Operating Expenses", amount: totalExpense },
        { item: "Net Profit", amount: netProfit },
      ],
      { grossProfit: s.profit, totalExpense, netProfit },
    );
  }

  return null;
}

router.get("/reports/:reportId", requirePermission("reports", "view"), async (req, res) => {
  try {
    const ds = await buildReport(req.params.reportId, req.tenantId, parseReportFilters(req.query));
    if (!ds) return res.status(404).json({ message: `Unknown report: ${req.params.reportId}` });
    res.json(ds);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Export (CSV / Excel / HTML-for-PDF) ──
router.get("/reports/:reportId/export", requirePermission("reports", "export"), async (req, res) => {
  try {
    const format = String(req.query.format || "csv").toLowerCase();
    if (!EXPORT_FORMATS.includes(format)) return res.status(400).json({ message: `format must be one of ${EXPORT_FORMATS.join(", ")}` });

    const report = getReport(req.params.reportId);
    const ds = await buildReport(req.params.reportId, req.tenantId, parseReportFilters(req.query));
    if (!ds) return res.status(404).json({ message: `Unknown report: ${req.params.reportId}` });
    const filenameBase = `${req.params.reportId}-report`;

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filenameBase}.csv"`);
      return res.send(toCSV(ds));
    }
    if (format === "html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(toHTML(ds, report.label));
    }
    // xlsx — reuse the existing exceljs dependency (loaded lazily).
    const ExcelJS = require("exceljs");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(report.label.slice(0, 31));
    ws.columns = ds.columns.map((c) => ({ header: c.label, key: c.key, width: 18 }));
    ws.addRows(ds.rows);
    ws.getRow(1).font = { bold: true };
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filenameBase}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Analytics ──
router.get("/analytics/top-customers", requirePermission("reports", "view"), async (req, res) => {
  try {
    const bookings = await fetchBookings(req.tenantId, parseReportFilters(req.query));
    res.json(topEntities(bookings, (b) => b.clientId, (b) => b.client?.name || "", (b) => b.amount, 10));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get("/analytics/top-agents", requirePermission("reports", "view"), async (req, res) => {
  try {
    const bookings = await fetchBookings(req.tenantId, parseReportFilters(req.query));
    res.json(topEntities(bookings, (b) => b.agentId, (b) => b.agent?.name || "", (b) => b.agentCommission?.agentCommissionAmount || 0, 10));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get("/analytics/top-suppliers", requirePermission("reports", "view"), async (req, res) => {
  try {
    const bills = await prisma.vendorBill.findMany({ where: { tenantId: req.tenantId }, select: { vendorId: true, totalAmount: true, vendor: { select: { name: true } } } });
    res.json(topEntities(bills, (b) => b.vendorId, (b) => b.vendor?.name || "", (b) => b.totalAmount, 10));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get("/analytics/top-services", requirePermission("reports", "view"), async (req, res) => {
  try {
    const bookings = await fetchBookings(req.tenantId, parseReportFilters(req.query));
    res.json(serviceWiseSummary(bookings));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get("/analytics/trends", requirePermission("reports", "view"), async (req, res) => {
  try {
    const metric = String(req.query.metric || "revenue");
    const bookings = await fetchBookings(req.tenantId, parseReportFilters(req.query));
    let trend;
    if (metric === "booking") trend = monthlyTrend(bookings, (b) => b.createdAt, () => 1);
    else if (metric === "revenue") trend = monthlyTrend(bookings, (b) => b.createdAt, (b) => b.amount);
    else trend = monthlyTrend(bookings, (b) => b.createdAt, (b) => b.profit); // "monthly" profit trend
    res.json({ metric, trend });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
