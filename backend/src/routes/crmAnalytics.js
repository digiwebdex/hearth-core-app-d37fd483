const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");

router.use(authenticate);

// GET /api/crm-analytics?from=YYYY-MM-DD&to=YYYY-MM-DD
// Lead funnel/conversion, source ROI, executive performance, retention,
// complaints and campaign summaries. Lead volume per tenant is small, so we
// fetch and aggregate in JS rather than running many groupBy queries.
router.get("/", requirePermission("clients", "view"), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const range = {};
    if (req.query.from) range.gte = new Date(String(req.query.from) + "T00:00:00");
    if (req.query.to) range.lte = new Date(String(req.query.to) + "T23:59:59");
    const leadWhere = { tenantId };
    if (range.gte || range.lte) leadWhere.createdAt = range;

    const [leads, users, bookings, complaints, campaigns] = await Promise.all([
      prisma.lead.findMany({ where: leadWhere, select: { status: true, source: true, budget: true, assignedTo: true } }),
      prisma.user.findMany({ where: { tenantId }, select: { id: true, name: true } }),
      prisma.booking.findMany({ where: { tenantId }, select: { clientId: true } }),
      prisma.complaint.findMany({ where: { tenantId }, select: { status: true, rating: true } }),
      prisma.campaign.findMany({ where: { tenantId }, select: { sentCount: true } }),
    ]);

    const userName = (id) => users.find((u) => u.id === id)?.name || "Unassigned";

    // ── Lead funnel + conversion ──
    const STATUSES = ["new", "contacted", "qualified", "quoted", "won", "lost"];
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const l of leads) if (byStatus[l.status] !== undefined) byStatus[l.status]++; else byStatus[l.status] = (byStatus[l.status] || 0) + 1;
    const total = leads.length;
    const won = byStatus.won || 0;
    const lost = byStatus.lost || 0;
    const pct = (n) => (total ? Math.round((n / total) * 1000) / 10 : 0);

    // ── Source ROI ──
    const sourceMap = {};
    for (const l of leads) {
      const s = l.source || "unknown";
      sourceMap[s] = sourceMap[s] || { source: s, total: 0, won: 0, value: 0 };
      sourceMap[s].total++;
      if (l.status === "won") { sourceMap[s].won++; sourceMap[s].value += l.budget || 0; }
    }
    const bySource = Object.values(sourceMap)
      .map((s) => ({ ...s, conversion: s.total ? Math.round((s.won / s.total) * 1000) / 10 : 0 }))
      .sort((a, b) => b.total - a.total);

    // ── Executive performance ──
    const assigneeMap = {};
    for (const l of leads) {
      const id = l.assignedTo || "unassigned";
      assigneeMap[id] = assigneeMap[id] || { userId: id, name: userName(l.assignedTo), total: 0, won: 0 };
      assigneeMap[id].total++;
      if (l.status === "won") assigneeMap[id].won++;
    }
    const byAssignee = Object.values(assigneeMap)
      .map((a) => ({ ...a, conversion: a.total ? Math.round((a.won / a.total) * 1000) / 10 : 0 }))
      .sort((a, b) => b.won - a.won || b.total - a.total);

    // ── Retention (repeat customers) ──
    const bookingsByClient = {};
    for (const b of bookings) if (b.clientId) bookingsByClient[b.clientId] = (bookingsByClient[b.clientId] || 0) + 1;
    const totalCustomers = Object.keys(bookingsByClient).length;
    const repeatCustomers = Object.values(bookingsByClient).filter((n) => n > 1).length;

    // ── Complaints + campaigns ──
    const rated = complaints.filter((c) => c.rating != null);
    const avgRating = rated.length ? Math.round((rated.reduce((s, c) => s + c.rating, 0) / rated.length) * 10) / 10 : null;

    res.json({
      leads: {
        total, won, lost,
        conversionRate: pct(won),
        lostRate: pct(lost),
        funnel: STATUSES.map((s) => ({ status: s, count: byStatus[s] || 0, pct: pct(byStatus[s] || 0) })),
      },
      bySource,
      byAssignee,
      retention: {
        totalCustomers,
        repeatCustomers,
        repeatRate: totalCustomers ? Math.round((repeatCustomers / totalCustomers) * 1000) / 10 : 0,
      },
      complaints: {
        total: complaints.length,
        open: complaints.filter((c) => c.status === "open" || c.status === "in_progress").length,
        resolved: complaints.filter((c) => c.status === "resolved" || c.status === "closed").length,
        avgRating,
      },
      campaigns: {
        total: campaigns.length,
        messagesSent: campaigns.reduce((s, c) => s + (c.sentCount || 0), 0),
      },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
