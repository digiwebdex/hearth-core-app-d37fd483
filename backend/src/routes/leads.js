const router = require("express").Router();
const { authenticate, requirePermission, checkPlanLimit, prisma } = require("../middleware/auth");
const { dispatchTenantAutomation } = require("../services/tenantAutomationService");

router.use(authenticate);

async function getTenantLead(leadId, tenantId) {
  return prisma.lead.findFirst({ where: { id: leadId, tenantId } });
}

function nonEmpty(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

router.get("/", requirePermission("leads", "view"), async (req, res) => {
  try { res.json(await prisma.lead.findMany({ where: { tenantId: req.tenantId }, orderBy: { createdAt: "desc" } })); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/pipeline-stats", requirePermission("leads", "view"), async (req, res) => {
  try {
    const leads = await prisma.lead.findMany({
      where: { tenantId: req.tenantId },
      select: { status: true, source: true },
    });
    const total = leads.length;
    const won = leads.filter((l) => l.status === "won").length;
    const lost = leads.filter((l) => l.status === "lost").length;
    const stages = ["new", "contacted", "qualified", "quoted", "won", "lost"];
    const byStage = stages.map((status) => ({
      status,
      count: leads.filter((l) => l.status === status).length,
    }));

    const sourceMap = {};
    for (const lead of leads) {
      const src = String(lead.source || "").trim() || "Unknown";
      if (!sourceMap[src]) sourceMap[src] = { total: 0, won: 0 };
      sourceMap[src].total += 1;
      if (lead.status === "won") sourceMap[src].won += 1;
    }
    const bySource = Object.entries(sourceMap)
      .map(([source, v]) => ({
        source,
        total: v.total,
        won: v.won,
        conversionRate: v.total > 0 ? ((v.won / v.total) * 100).toFixed(1) : "0",
      }))
      .sort((a, b) => b.total - a.total);

    res.json({
      total,
      won,
      lost,
      active: total - won - lost,
      conversionRate: total > 0 ? ((won / total) * 100).toFixed(1) : "0",
      byStage,
      bySource,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/check-duplicate", requirePermission("leads", "view"), async (req, res) => {
  try {
    const email = nonEmpty(req.query.email);
    const phone = nonEmpty(req.query.phone);
    const orConditions = [];
    if (email) orConditions.push({ email });
    if (phone) orConditions.push({ phone });
    if (!orConditions.length) return res.json({ exists: false });

    const client = await prisma.client.findFirst({ where: { tenantId: req.tenantId, OR: orConditions } });
    res.json({ exists: !!client, client: client || undefined });
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.get("/:id", requirePermission("leads", "view"), async (req, res) => {
  try {
    const item = await getTenantLead(req.params.id, req.tenantId);
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.post("/", requirePermission("leads", "create"), checkPlanLimit("leads"), async (req, res) => {
  try {
    const lead = await prisma.lead.create({ data: { ...req.body, tenantId: req.tenantId } });
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId }, select: { name: true } });

    dispatchTenantAutomation("lead_created", {
      tenantId: req.tenantId,
      actorUserId: req.userId,
      payload: {
        relatedType: "lead",
        relatedId: lead.id,
        leadName: lead.name,
        leadPhone: lead.phone,
        leadSource: lead.source,
        tenantName: tenant?.name || "",
      },
    }).catch((err) => console.error("[automation] lead_created:", err.message));

    res.status(201).json(lead);
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.patch("/:id", requirePermission("leads", "edit"), async (req, res) => {
  try {
    const result = await prisma.lead.updateMany({ where: { id: req.params.id, tenantId: req.tenantId }, data: req.body });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json(await prisma.lead.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.delete("/:id", requirePermission("leads", "delete"), async (req, res) => {
  try {
    const result = await prisma.lead.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.patch("/:id/status", requirePermission("leads", "edit"), async (req, res) => {
  try {
    const old = await getTenantLead(req.params.id, req.tenantId);
    if (!old) return res.status(404).json({ message: "Not found" });
    await prisma.lead.updateMany({ where: { id: req.params.id, tenantId: req.tenantId }, data: { status: req.body.status } });
    await prisma.leadActivity.create({ data: { leadId: req.params.id, type: "status_change", content: `Status changed from ${old.status} to ${req.body.status}`, oldStatus: old.status, newStatus: req.body.status, createdBy: req.userId } });

    // CRM automation: when a lead is won, optionally create a follow-up task.
    if (req.body.status === "won" && old.status !== "won") {
      const cfg = await prisma.crmConfig.findUnique({ where: { tenantId: req.tenantId } }).catch(() => null);
      if (cfg?.automations?.leadWonCreateTask) {
        await prisma.task.create({
          data: {
            title: `Onboard won lead: ${old.name}`,
            description: `Lead "${old.name}" was marked won. Follow up to confirm booking and collect documents.`,
            status: "todo", priority: "high",
            assignedTo: old.assignedTo || req.userId,
            tenantId: req.tenantId,
          },
        }).catch((err) => console.error("[automation] leadWonCreateTask:", err.message));
      }
    }
    res.json(await prisma.lead.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } }));
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.get("/:id/activities", requirePermission("leads", "view"), async (req, res) => {
  try {
    const lead = await getTenantLead(req.params.id, req.tenantId);
    if (!lead) return res.status(404).json({ message: "Not found" });
    res.json(await prisma.leadActivity.findMany({ where: { leadId: req.params.id }, orderBy: { createdAt: "desc" } }));
  }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.post("/:id/activities", requirePermission("leads", "create"), async (req, res) => {
  try {
    const lead = await getTenantLead(req.params.id, req.tenantId);
    if (!lead) return res.status(404).json({ message: "Not found" });
    res.status(201).json(await prisma.leadActivity.create({ data: { ...req.body, leadId: req.params.id, createdBy: req.userId } }));
  }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.post("/:id/convert", requirePermission("leads", "edit"), async (req, res) => {
  try {
    const lead = await getTenantLead(req.params.id, req.tenantId);
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    const orConditions = [];
    if (nonEmpty(lead.email)) orConditions.push({ email: lead.email });
    if (nonEmpty(lead.phone)) orConditions.push({ phone: lead.phone });
    const existing = orConditions.length ? await prisma.client.findFirst({ where: { tenantId: req.tenantId, OR: orConditions } }) : null;
    if (existing) {
      await prisma.lead.update({ where: { id: lead.id }, data: { status: "won", clientId: existing.id } });
      return res.json(existing);
    }

    const client = await prisma.client.create({ data: { name: lead.name, phone: lead.phone, email: lead.email, tenantId: req.tenantId } });
    await prisma.lead.update({ where: { id: lead.id }, data: { status: "won", clientId: client.id } });

    // Audit log — lead conversion
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true, email: true, role: true } });
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId }, select: { name: true } });
    await prisma.auditLog.create({
      data: {
        actorId: req.userId, actorName: user?.name || "", actorEmail: user?.email || "", actorRole: user?.role || "",
        tenantId: req.tenantId, tenantName: tenant?.name || null,
        module: "lead", action: "converted",
        targetType: "lead", targetId: lead.id, targetLabel: lead.name,
        newValue: JSON.stringify({ clientId: client.id, clientName: client.name }),
      },
    }).catch(() => {});

    res.json(client);
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.get("/:id/quotations", requirePermission("leads", "view"), async (req, res) => {
  try {
    const lead = await getTenantLead(req.params.id, req.tenantId);
    if (!lead) return res.status(404).json({ message: "Not found" });
    res.json(await prisma.quotation.findMany({ where: { leadId: req.params.id, tenantId: req.tenantId } }));
  }
  catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;