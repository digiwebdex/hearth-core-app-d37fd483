const router = require("express").Router();
const { authenticate, requirePermission, checkPlanLimit, prisma } = require("../middleware/auth");
const { enrichQuotationFromPackage } = require("../services/packageLinkage");

router.use(authenticate);

function nonEmpty(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

async function resolveClientForQuotation(quotation, tenantId) {
  if (quotation.clientId) return quotation;

  if (quotation.leadId) {
    const lead = await prisma.lead.findFirst({ where: { id: quotation.leadId, tenantId } });
    if (!lead) return quotation;

    if (lead.clientId) {
      return prisma.quotation.update({
        where: { id: quotation.id },
        data: { clientId: lead.clientId, clientName: lead.name },
      });
    }

    const orConditions = [];
    const email = nonEmpty(lead.email);
    const phone = nonEmpty(lead.phone);
    if (email) orConditions.push({ email });
    if (phone) orConditions.push({ phone });

    let client = orConditions.length
      ? await prisma.client.findFirst({ where: { tenantId, OR: orConditions } })
      : null;

    if (!client) {
      client = await prisma.client.create({
        data: { name: lead.name, phone: phone || "", email: email || "", tenantId },
      });
    }

    await prisma.lead.update({ where: { id: lead.id }, data: { clientId: client.id } }).catch(() => {});

    return prisma.quotation.update({
      where: { id: quotation.id },
      data: { clientId: client.id, clientName: client.name },
    });
  }

  const name = nonEmpty(quotation.clientName);
  if (name) {
    let client = await prisma.client.findFirst({
      where: { tenantId, name: { equals: name, mode: "insensitive" } },
      select: { id: true, name: true },
    });

    if (!client) {
      client = await prisma.client.create({
        data: { name, phone: "", email: "", tenantId },
        select: { id: true, name: true },
      });
    }

    return prisma.quotation.update({
      where: { id: quotation.id },
      data: { clientId: client.id, clientName: client.name },
    });
  }

  return quotation;
}

async function dispatchQuotationSentAutomation(quotation, tenantId, userId) {
  const { dispatchTenantAutomation } = require("../services/tenantAutomationService");
  let clientPhone = "";
  let clientName = quotation.clientName || "";

  if (quotation.clientId) {
    const client = await prisma.client.findFirst({
      where: { id: quotation.clientId, tenantId },
      select: { name: true, phone: true },
    });
    clientPhone = client?.phone || "";
    clientName = client?.name || clientName;
  } else if (quotation.leadId) {
    const lead = await prisma.lead.findFirst({
      where: { id: quotation.leadId, tenantId },
      select: { name: true, phone: true },
    });
    clientPhone = lead?.phone || "";
    clientName = lead?.name || quotation.leadName || clientName;
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });

  await dispatchTenantAutomation("quotation_sent", {
    tenantId,
    actorUserId: userId,
    payload: {
      relatedType: "quotation",
      relatedId: quotation.id,
      quotationTitle: quotation.title,
      quotationTotal: quotation.grandTotal,
      destination: quotation.destination,
      clientName,
      clientPhone,
      tenantName: tenant?.name || "",
    },
  }).catch((err) => console.error("[automation] quotation_sent:", err.message));
}

async function handleQuotationSentTransition(previousStatus, quotation, tenantId, userId) {
  if (quotation.status !== "sent" || previousStatus === "sent") return quotation;

  let updated = await resolveClientForQuotation(quotation, tenantId);
  await dispatchQuotationSentAutomation(updated, tenantId, userId);
  return updated;
}

router.get("/", requirePermission("quotations", "view"), async (req, res) => {
  try { res.json(await prisma.quotation.findMany({ where: { tenantId: req.tenantId }, orderBy: { createdAt: "desc" } })); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.get("/:id", requirePermission("quotations", "view"), async (req, res) => {
  try {
    const q = await prisma.quotation.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!q) return res.status(404).json({ message: "Not found" });
    res.json(q);
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.post("/", requirePermission("quotations", "create"), checkPlanLimit("quotations"), async (req, res) => {
  try {
    const data = await enrichQuotationFromPackage(req.body, req.tenantId);
    const quotation = await prisma.quotation.create({ data: { ...data, createdBy: req.userId, tenantId: req.tenantId } });
    if (data.leadId) {
      await prisma.lead.updateMany({
        where: { id: data.leadId, tenantId: req.tenantId, status: { notIn: ["won", "lost"] } },
        data: { status: "quoted" },
      });
      await prisma.leadActivity.create({
        data: {
          leadId: data.leadId,
          type: "status_change",
          content: `Quotation created: ${data.title || data.destination || "New quote"}`,
          newStatus: "quoted",
          createdBy: req.userId,
        },
      }).catch(() => {});
    }
    const result = await handleQuotationSentTransition(null, quotation, req.tenantId, req.userId);
    res.status(201).json(result);
  }
  catch (err) { res.status(400).json({ message: err.message }); }
});
router.patch("/:id", requirePermission("quotations", "edit"), async (req, res) => {
  try {
    const existing = await prisma.quotation.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "Not found" });

    const previousStatus = existing.status;
    const result = await prisma.quotation.updateMany({ where: { id: req.params.id, tenantId: req.tenantId }, data: req.body });
    if (!result.count) return res.status(404).json({ message: "Not found" });

    let quotation = await prisma.quotation.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    quotation = await handleQuotationSentTransition(previousStatus, quotation, req.tenantId, req.userId);
    res.json(quotation);
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.delete("/:id", requirePermission("quotations", "delete"), async (req, res) => {
  try {
    const result = await prisma.quotation.deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.patch("/:id/status", requirePermission("quotations", "edit"), async (req, res) => {
  try {
    const status = req.body.status;
    const existing = await prisma.quotation.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "Not found" });

    const previousStatus = existing.status;
    const result = await prisma.quotation.updateMany({ where: { id: req.params.id, tenantId: req.tenantId }, data: { status } });
    if (!result.count) return res.status(404).json({ message: "Not found" });

    let quotation = await prisma.quotation.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    quotation = await handleQuotationSentTransition(previousStatus, quotation, req.tenantId, req.userId);
    res.json(quotation);
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.get("/:id/versions", requirePermission("quotations", "view"), async (req, res) => {
  try {
    const quotation = await prisma.quotation.findFirst({ where: { id: req.params.id, tenantId: req.tenantId }, select: { id: true } });
    if (!quotation) return res.status(404).json({ message: "Not found" });
    res.json(await prisma.quotationVersion.findMany({ where: { quotationId: req.params.id }, orderBy: { versionNumber: "desc" } }));
  }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.post("/:id/duplicate", requirePermission("quotations", "create"), async (req, res) => {
  try {
    const orig = await prisma.quotation.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!orig) return res.status(404).json({ message: "Not found" });
    const { id, createdAt, updatedAt, ...data } = orig;
    const dup = await prisma.quotation.create({ data: { ...data, title: `${data.title} (Copy)`, status: "draft", version: 1, createdBy: req.userId, tenantId: req.tenantId } });
    res.status(201).json(dup);
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.post("/:id/convert-to-booking", requirePermission("quotations", "approve"), async (req, res) => {
  try {
    let q = await prisma.quotation.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!q) return res.status(404).json({ message: "Not found" });

    q = await resolveClientForQuotation(q, req.tenantId);
    if (!q.clientId) return res.status(400).json({ message: "Client is required before converting quotation to booking" });

    const booking = await prisma.booking.create({
      data: {
        title: q.title,
        clientId: q.clientId,
        quotationId: q.id,
        packageId: q.packageId || undefined,
        serviceType: q.serviceType || undefined,
        packageTitleSnapshot: q.packageTitleSnapshot || undefined,
        packageCodeSnapshot: q.packageCodeSnapshot || undefined,
        destination: q.destination,
        travelDateFrom: q.travelDateFrom,
        travelDateTo: q.travelDateTo,
        travelerCount: q.travelerCount,
        amount: q.grandTotal,
        cost: q.totalCost,
        profit: q.totalProfit,
        paidAmount: 0,
        dueAmount: q.grandTotal,
        paymentStatus: "unpaid",
        status: "pending",
        tenantId: req.tenantId,
      },
    });

    await prisma.quotation.update({ where: { id: q.id }, data: { status: "approved" } });

    if (q.leadId) {
      await prisma.lead.updateMany({
        where: { id: q.leadId, tenantId: req.tenantId, status: { notIn: ["lost"] } },
        data: { status: "won", clientId: q.clientId },
      }).catch(() => {});
    }

    res.status(201).json(booking);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
