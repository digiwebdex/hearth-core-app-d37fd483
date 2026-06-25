const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");
const { dispatchTenantAutomation } = require("../services/tenantAutomationService");

router.use(authenticate);

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

router.get("/reminders", requirePermission("invoices", "view"), async (req, res) => {
  try {
    const today = todayIso();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 7);
    const horizonIso = horizon.toISOString().slice(0, 10);

    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId: req.tenantId,
        status: { in: ["unpaid", "partial", "overdue"] },
      },
      orderBy: { dueDate: "asc" },
      take: 200,
    });

    const overdueInvoices = invoices.filter((inv) => inv.dueDate && inv.dueDate < today);
    const dueSoonInvoices = invoices.filter(
      (inv) => inv.dueDate && inv.dueDate >= today && inv.dueDate <= horizonIso,
    );

    const installments = await prisma.invoiceInstallment.findMany({
      where: {
        tenantId: req.tenantId,
        status: { in: ["pending", "partial"] },
        dueDate: { not: null },
      },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            clientName: true,
            bookingTitle: true,
            dueAmount: true,
          },
        },
      },
      orderBy: { dueDate: "asc" },
      take: 200,
    });

    const overdueInstallments = installments.filter((row) => row.dueDate < today);
    const dueSoonInstallments = installments.filter(
      (row) => row.dueDate >= today && row.dueDate <= horizonIso,
    );

    res.json({
      today,
      overdueInvoices,
      dueSoonInvoices,
      overdueInstallments,
      dueSoonInstallments,
      counts: {
        overdueInvoices: overdueInvoices.length,
        dueSoonInvoices: dueSoonInvoices.length,
        overdueInstallments: overdueInstallments.length,
        dueSoonInstallments: dueSoonInstallments.length,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/reminders/:invoiceId/send", requirePermission("invoices", "edit"), async (req, res) => {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.invoiceId, tenantId: req.tenantId },
      include: { client: { select: { email: true, name: true, phone: true } } },
    });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const client = invoice.client;
    await dispatchTenantAutomation("invoice_reminder", {
      tenantId: req.tenantId,
      actorUserId: req.userId,
      payload: {
        relatedType: "invoice",
        relatedId: invoice.id,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        dueAmount: invoice.dueAmount,
        dueDate: invoice.dueDate,
        clientName: client?.name || invoice.clientName || "",
        clientEmail: client?.email || "",
        clientPhone: client?.phone || "",
      },
    }).catch((err) => console.error("[automation] invoice_reminder:", err.message));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Financial Statement Helpers ──

function dateRange(from, to) {
  const filter = {};
  if (from) filter.gte = from;
  if (to) filter.lte = to;
  return Object.keys(filter).length ? filter : undefined;
}

// GET /api/finance/pl — Profit & Loss statement
router.get("/pl", requirePermission("reports", "view"), async (req, res) => {
  try {
    const { from, to } = req.query;
    const tid = req.tenantId;
    const dateFilter = dateRange(from, to);

    const paymentWhere = {
      tenantId: tid,
      ...(dateFilter ? { date: dateFilter } : {}),
    };
    const expenseWhere = {
      tenantId: tid,
      status: { in: ["approved", "paid"] },
      ...(dateFilter ? { date: dateFilter } : {}),
    };
    const vendorBillPaymentWhere = {
      bill: { tenantId: tid },
      ...(dateFilter ? { date: dateFilter } : {}),
    };

    const [payments, expenses, vendorBillPayments, taxData] = await Promise.all([
      prisma.payment.findMany({ where: paymentWhere, select: { amount: true, date: true, method: true } }),
      prisma.expense.findMany({ where: expenseWhere, select: { amount: true, date: true, category: true } }),
      prisma.vendorBillPayment.findMany({
        where: vendorBillPaymentWhere,
        select: { amount: true, date: true },
      }),
      prisma.invoice.findMany({
        where: { tenantId: tid, status: { in: ["paid", "partial"] }, ...(dateFilter ? { issuedDate: dateFilter } : {}) },
        select: { taxAmount: true, subTotal: true, totalAmount: true },
      }),
    ]);

    const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const totalVendorCosts = vendorBillPayments.reduce((s, v) => s + v.amount, 0);
    const totalTaxCollected = taxData.reduce((s, i) => s + (i.taxAmount || 0), 0);
    const grossProfit = totalRevenue - totalVendorCosts;
    const netProfit = grossProfit - totalExpenses;

    const expensesByCategory = expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {});

    res.json({
      period: { from, to },
      revenue: {
        total: totalRevenue,
        taxCollected: totalTaxCollected,
        netRevenue: totalRevenue - totalTaxCollected,
      },
      costOfSales: {
        vendorCosts: totalVendorCosts,
      },
      grossProfit,
      operatingExpenses: {
        total: totalExpenses,
        byCategory: expensesByCategory,
      },
      netProfit,
    });
  } catch (err) {
    console.error("GET /finance/pl error", err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/finance/balance-sheet — Assets vs Liabilities snapshot
router.get("/balance-sheet", requirePermission("reports", "view"), async (req, res) => {
  try {
    const tid = req.tenantId;

    const [accounts, unpaidInvoices, unpaidVendorBills] = await Promise.all([
      prisma.account.findMany({ where: { tenantId: tid, status: "active" }, select: { id: true, name: true, type: true, balance: true } }),
      prisma.invoice.findMany({ where: { tenantId: tid, status: { in: ["unpaid", "partial", "overdue"] } }, select: { dueAmount: true } }),
      prisma.vendorBill.findMany({ where: { tenantId: tid, status: { in: ["unpaid", "partial"] } }, select: { dueAmount: true } }),
    ]);

    const cashBankAccounts = accounts.filter((a) => ["cash", "bank"].includes(a.type));
    const totalCash = cashBankAccounts.reduce((s, a) => s + a.balance, 0);
    const accountsReceivable = unpaidInvoices.reduce((s, i) => s + i.dueAmount, 0);
    const totalAssets = totalCash + accountsReceivable;

    const accountsPayable = unpaidVendorBills.reduce((s, v) => s + v.dueAmount, 0);
    const totalLiabilities = accountsPayable;
    const netEquity = totalAssets - totalLiabilities;

    res.json({
      assets: {
        cashAndBank: { total: totalCash, accounts: cashBankAccounts },
        accountsReceivable,
        totalAssets,
      },
      liabilities: {
        accountsPayable,
        totalLiabilities,
      },
      equity: netEquity,
    });
  } catch (err) {
    console.error("GET /finance/balance-sheet error", err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/finance/cash-flow — Monthly cash inflows vs outflows
router.get("/cash-flow", requirePermission("reports", "view"), async (req, res) => {
  try {
    const { from, to } = req.query;
    const tid = req.tenantId;
    const dateFilter = dateRange(from, to);

    const [payments, expenses, vendorBillPayments] = await Promise.all([
      prisma.payment.findMany({
        where: { tenantId: tid, ...(dateFilter ? { date: dateFilter } : {}) },
        select: { amount: true, date: true },
      }),
      prisma.expense.findMany({
        where: { tenantId: tid, status: { in: ["approved", "paid"] }, ...(dateFilter ? { date: dateFilter } : {}) },
        select: { amount: true, date: true },
      }),
      prisma.vendorBillPayment.findMany({
        where: { bill: { tenantId: tid }, ...(dateFilter ? { date: dateFilter } : {}) },
        select: { amount: true, date: true },
      }),
    ]);

    // Group by YYYY-MM
    const monthlyMap = {};
    const addToMonth = (date, key, amount) => {
      const month = String(date).slice(0, 7);
      if (!monthlyMap[month]) monthlyMap[month] = { month, inflows: 0, outflows: 0 };
      monthlyMap[month][key] += amount;
    };

    payments.forEach((p) => addToMonth(p.date, "inflows", p.amount));
    expenses.forEach((e) => addToMonth(e.date, "outflows", e.amount));
    vendorBillPayments.forEach((v) => addToMonth(v.date, "outflows", v.amount));

    const months = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));
    months.forEach((m) => { m.net = m.inflows - m.outflows; });

    const totalInflows = payments.reduce((s, p) => s + p.amount, 0);
    const totalOutflows = expenses.reduce((s, e) => s + e.amount, 0) + vendorBillPayments.reduce((s, v) => s + v.amount, 0);

    res.json({
      period: { from, to },
      summary: { totalInflows, totalOutflows, net: totalInflows - totalOutflows },
      monthly: months,
    });
  } catch (err) {
    console.error("GET /finance/cash-flow error", err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/finance/tax-report — Tax collected summary
router.get("/tax-report", requirePermission("reports", "view"), async (req, res) => {
  try {
    const { from, to } = req.query;
    const tid = req.tenantId;
    const dateFilter = dateRange(from, to);

    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId: tid,
        status: { in: ["paid", "partial"] },
        taxAmount: { gt: 0 },
        ...(dateFilter ? { issuedDate: dateFilter } : {}),
      },
      select: {
        id: true,
        invoiceNumber: true,
        clientName: true,
        issuedDate: true,
        subTotal: true,
        taxAmount: true,
        taxRate: true,
        totalAmount: true,
      },
    });

    const totalTaxCollected = invoices.reduce((s, i) => s + (i.taxAmount || 0), 0);
    const totalSubTotal = invoices.reduce((s, i) => s + (i.subTotal || 0), 0);

    res.json({
      period: { from, to },
      summary: { totalSubTotal, totalTaxCollected, invoiceCount: invoices.length },
      invoices,
    });
  } catch (err) {
    console.error("GET /finance/tax-report error", err);
    res.status(500).json({ message: err.message });
  }
});

// ── Advanced Sales & Booking Analytics ──

// GET /api/finance/sales-analytics?from=&to=
router.get("/sales-analytics", requirePermission("reports", "view"), async (req, res) => {
  try {
    const { from, to } = req.query;
    const tid = req.tenantId;
    const dateFilter = dateRange(from, to);

    const bookingWhere = {
      tenantId: tid,
      ...(dateFilter ? { createdAt: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } } : {}),
    };

    const [bookings, leads, quotations] = await Promise.all([
      prisma.booking.findMany({
        where: bookingWhere,
        select: {
          id: true, destination: true, amount: true, profit: true, status: true,
          serviceType: true, createdAt: true, assignedTo: true, agentId: true,
          agent: { select: { id: true, name: true } },
        },
      }),
      prisma.lead.findMany({
        where: { tenantId: tid, ...(dateFilter ? { createdAt: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } } : {}) },
        select: { id: true, status: true, destination: true, createdAt: true, assignedTo: true },
      }),
      prisma.quotation.findMany({
        where: { tenantId: tid, ...(dateFilter ? { createdAt: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } } : {}) },
        select: { id: true, status: true, grandTotal: true, destination: true, createdAt: true },
      }),
    ]);

    // Destination analytics
    const destMap = {};
    bookings.forEach((b) => {
      const dest = b.destination || "Unknown";
      if (!destMap[dest]) destMap[dest] = { destination: dest, bookings: 0, revenue: 0, profit: 0 };
      destMap[dest].bookings++;
      destMap[dest].revenue += b.amount;
      destMap[dest].profit += b.profit;
    });
    const topDestinations = Object.values(destMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Agent performance
    const agentMap = {};
    bookings.forEach((b) => {
      const key = b.agentId || "unassigned";
      const name = b.agent?.name || b.assignedTo || "Unassigned";
      if (!agentMap[key]) agentMap[key] = { agentId: key, agentName: name, bookings: 0, revenue: 0, profit: 0 };
      agentMap[key].bookings++;
      agentMap[key].revenue += b.amount;
      agentMap[key].profit += b.profit;
    });
    const agentPerformance = Object.values(agentMap).sort((a, b) => b.revenue - a.revenue);

    // Service type breakdown
    const serviceMap = {};
    bookings.forEach((b) => {
      const st = b.serviceType || "other";
      if (!serviceMap[st]) serviceMap[st] = { serviceType: st, bookings: 0, revenue: 0 };
      serviceMap[st].bookings++;
      serviceMap[st].revenue += b.amount;
    });
    const serviceBreakdown = Object.values(serviceMap).sort((a, b) => b.bookings - a.bookings);

    // Monthly booking trend
    const monthMap = {};
    bookings.forEach((b) => {
      const month = new Date(b.createdAt).toISOString().slice(0, 7);
      if (!monthMap[month]) monthMap[month] = { month, bookings: 0, revenue: 0 };
      monthMap[month].bookings++;
      monthMap[month].revenue += b.amount;
    });
    const monthlyTrend = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));

    // Conversion funnel
    const totalLeads = leads.length;
    const convertedLeads = leads.filter((l) => ["converted", "booked"].includes(l.status)).length;
    const totalQuotations = quotations.length;
    const acceptedQuotations = quotations.filter((q) => ["accepted", "booked"].includes(q.status)).length;
    const totalBookings = bookings.length;
    const confirmedBookings = bookings.filter((b) => ["confirmed", "completed"].includes(b.status)).length;

    res.json({
      period: { from, to },
      summary: {
        totalBookings,
        totalRevenue: bookings.reduce((s, b) => s + b.amount, 0),
        totalProfit: bookings.reduce((s, b) => s + b.profit, 0),
        avgBookingValue: totalBookings ? bookings.reduce((s, b) => s + b.amount, 0) / totalBookings : 0,
      },
      topDestinations,
      agentPerformance,
      serviceBreakdown,
      monthlyTrend,
      conversionFunnel: {
        leads: totalLeads,
        leadsConverted: convertedLeads,
        leadConversionRate: totalLeads ? Math.round((convertedLeads / totalLeads) * 100) : 0,
        quotations: totalQuotations,
        quotationsAccepted: acceptedQuotations,
        quotationConversionRate: totalQuotations ? Math.round((acceptedQuotations / totalQuotations) * 100) : 0,
        bookings: totalBookings,
        bookingsConfirmed: confirmedBookings,
      },
    });
  } catch (err) {
    console.error("GET /finance/sales-analytics error", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
