const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");

router.use(authenticate);

router.get("/stats", requirePermission("dashboard", "view"), async (req, res) => {
  try {
    const tid = req.tenantId;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartIso = monthStart.toISOString();
    const today = now.toISOString().slice(0, 10);
    const week = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);

    const [clients, bookings, invoices, leads, payments, vendors, quotations, users] = await Promise.all([
      prisma.client.count({ where: { tenantId: tid } }),
      prisma.booking.findMany({
        where: { tenantId: tid },
        include: { client: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.invoice.findMany({ where: { tenantId: tid } }),
      prisma.lead.findMany({ where: { tenantId: tid } }),
      prisma.payment.findMany({ where: { tenantId: tid }, orderBy: { createdAt: "desc" }, take: 10 }),
      prisma.vendorBill.findMany({ where: { tenantId: tid, status: { in: ["unpaid", "partial", "overdue"] } } }),
      prisma.quotation.findMany({ where: { tenantId: tid } }),
      prisma.user.count({ where: { tenantId: tid } }),
    ]);

    const activeLeads = leads.filter((l) => !["won", "lost"].includes(l.status)).length;
    const followUps = leads.filter((l) => l.nextFollowUp && l.nextFollowUp <= today && !["won", "lost"].includes(l.status)).length;
    const recentBookings = bookings.slice(0, 5).map((booking) => ({
      ...booking,
      clientName: booking.client?.name || "",
    }));
    const confirmed = bookings.filter((b) => b.status === "confirmed").length;
    const upcoming = bookings.filter((b) => b.travelDateFrom && b.travelDateFrom >= today && b.travelDateFrom <= week).length;
    const overdue = invoices.filter((i) => i.status === "overdue" || (i.dueDate && i.dueDate < today && i.dueAmount > 0));
    const salesMonth = payments
      .filter((p) => new Date(p.date || p.createdAt) >= monthStart)
      .reduce((s, p) => s + p.amount, 0);
    const vendorDues = vendors.reduce((s, v) => s + v.dueAmount, 0);
    const quotationsSentThisMonth = quotations.filter((q) => q.status === "sent" && new Date(q.createdAt) >= monthStart).length;
    const quotationsAwaitingApproval = quotations.filter((q) => q.status === "sent").length;

    // Top destinations
    const destMap = {};
    bookings.forEach((b) => { if (b.destination) destMap[b.destination] = (destMap[b.destination] || 0) + 1; });
    const topDestinations = Object.entries(destMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([destination, count]) => ({ destination, count }));

    const typeMap = {};
    bookings.forEach((b) => {
      const key = String(b.type || "other").trim() || "other";
      typeMap[key] = (typeMap[key] || 0) + 1;
    });
    const bookingsByType = Object.entries(typeMap)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));

    const openSupportTickets = await prisma.supportTicket.count({
      where: { tenantId: tid, status: { in: ["open", "assigned", "in_progress"] } },
    }).catch(() => 0);

    const passportWindowEnd = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    const tenantClients = await prisma.client.findMany({
      where: { tenantId: tid, passportExpiry: { not: null } },
      select: { passportExpiry: true },
    });
    const todayStr = today;
    let passportsExpiringSoon = 0;
    let passportsExpired = 0;
    for (const c of tenantClients) {
      const exp = String(c.passportExpiry || "").slice(0, 10);
      if (!exp) continue;
      if (exp < todayStr) passportsExpired += 1;
      else if (exp <= passportWindowEnd) passportsExpiringSoon += 1;
    }

    const base = {
      totalUsers: users,
      totalClients: clients,
      totalBookings: bookings.length,
      recentBookings,
      activeLeads,
      followUpsDueToday: followUps,
      quotationsSentThisMonth,
      quotationsAwaitingApproval,
      confirmedBookings: confirmed,
      upcomingDepartures: upcoming,
      topDestinations,
      bookingsByType,
      openSupportTickets,
      passportsExpiringSoon,
      passportsExpired,
    };

    // Finance-sensitive widgets: show only to finance roles.
    const financeRoles = new Set(["super_admin", "tenant_owner", "manager", "accountant"]);
    if (financeRoles.has(req.userRole)) {
      return res.json({
        ...base,
        totalRevenue: invoices.reduce((s, i) => s + i.paidAmount, 0),
        recentPayments: payments,
        overdueInvoices: overdue.length,
        overdueInvoiceAmount: overdue.reduce((s, i) => s + i.dueAmount, 0),
        vendorDues,
        salesThisMonth: salesMonth,
      });
    }

    return res.json(base);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;