const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");
const { enrichQuotationFromPackage } = require("../services/packageLinkage");

router.use(authenticate);

const QUOTATION_INCLUDE = {
  client: { select: { name: true, phone: true, email: true } },
  lead: { select: { name: true, phone: true, email: true } },
};

const QUOTATION_WRITE_FIELDS = new Set([
  "title", "clientId", "leadId", "packageId", "serviceType",
  "packageTitleSnapshot", "packageCodeSnapshot", "destination",
  "travelDateFrom", "travelDateTo", "travelerCount", "status", "version",
  "items", "itinerary", "totalCost", "totalSelling", "totalProfit",
  "discountAmount", "taxAmount", "grandTotal", "validUntil", "notes", "termsAndConditions",
]);

function nonEmpty(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function formatQuotation(row) {
  if (!row) return row;
  const { client, lead, ...rest } = row;
  return {
    ...rest,
    clientName: client?.name || undefined,
    leadName: lead?.name || undefined,
  };
}

function parseQuotationBody(body) {
  const clientName = nonEmpty(body.clientName);
  const leadName = nonEmpty(body.leadName);
  const prismaData = {};
  for (const key of QUOTATION_WRITE_FIELDS) {
    if (body[key] !== undefined) prismaData[key] = body[key];
  }
  return { prismaData, clientName, leadName };
}

async function resolveClientForQuotation(quotation, tenantId, { clientName: clientNameHint } = {}) {
  if (quotation.clientId) return quotation;

  if (quotation.leadId) {
    const lead = await prisma.lead.findFirst({ where: { id: quotation.leadId, tenantId } });
    if (!lead) return quotation;

    if (lead.clientId) {
      return prisma.quotation.update({
        where: { id: quotation.id },
        data: { clientId: lead.clientId },
        include: QUOTATION_INCLUDE,
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
      data: { clientId: client.id },
      include: QUOTATION_INCLUDE,
    });
  }

  const name = clientNameHint || null;
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
      data: { clientId: client.id },
      include: QUOTATION_INCLUDE,
    });
  }

  return quotation;
}

async function dispatchQuotationSentAutomation(quotation, tenantId, userId) {
  const { dispatchTenantAutomation } = require("../services/tenantAutomationService");
  const formatted = formatQuotation(quotation);
  let clientPhone = "";
  let clientName = formatted.clientName || "";

  if (quotation.clientId) {
    const client = quotation.client || await prisma.client.findFirst({
      where: { id: quotation.clientId, tenantId },
      select: { name: true, phone: true },
    });
    clientPhone = client?.phone || "";
    clientName = client?.name || clientName;
  } else if (quotation.leadId) {
    const lead = quotation.lead || await prisma.lead.findFirst({
      where: { id: quotation.leadId, tenantId },
      select: { name: true, phone: true },
    });
    clientPhone = lead?.phone || "";
    clientName = lead?.name || formatted.leadName || clientName;
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

async function handleQuotationSentTransition(previousStatus, quotation, tenantId, userId, hints = {}) {
  if (quotation.status !== "sent" || previousStatus === "sent") {
    return formatQuotation(quotation.client || quotation.lead ? quotation : await prisma.quotation.findFirst({
      where: { id: quotation.id, tenantId },
      include: QUOTATION_INCLUDE,
    }));
  }

  let updated = await resolveClientForQuotation(quotation, tenantId, hints);
  await dispatchQuotationSentAutomation(updated, tenantId, userId);
  return formatQuotation(updated);
}

router.get("/", requirePermission("quotations", "view"), async (req, res) => {
  try {
    const rows = await prisma.quotation.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: "desc" },
      include: QUOTATION_INCLUDE,
    });
    res.json(rows.map(formatQuotation));
  }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.get("/:id", requirePermission("quotations", "view"), async (req, res) => {
  try {
    const q = await prisma.quotation.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: QUOTATION_INCLUDE,
    });
    if (!q) return res.status(404).json({ message: "Not found" });
    res.json(formatQuotation(q));
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.post("/", requirePermission("quotations", "create"), async (req, res) => {
  try {
    const enriched = await enrichQuotationFromPackage(req.body, req.tenantId);
    const { prismaData, clientName } = parseQuotationBody(enriched);
    let quotation = await prisma.quotation.create({
      data: { ...prismaData, createdBy: req.userId, tenantId: req.tenantId },
      include: QUOTATION_INCLUDE,
    });
    if (clientName || prismaData.leadId) {
      quotation = await resolveClientForQuotation(quotation, req.tenantId, { clientName });
    }
    if (prismaData.leadId) {
      await prisma.lead.updateMany({
        where: { id: prismaData.leadId, tenantId: req.tenantId, status: { notIn: ["won", "lost"] } },
        data: { status: "quoted" },
      });
      await prisma.leadActivity.create({
        data: {
          leadId: prismaData.leadId,
          type: "status_change",
          content: `Quotation created: ${prismaData.title || prismaData.destination || "New quote"}`,
          newStatus: "quoted",
          createdBy: req.userId,
        },
      }).catch(() => {});
    }
    const result = await handleQuotationSentTransition(null, quotation, req.tenantId, req.userId, { clientName });
    res.status(201).json(result);
  }
  catch (err) { res.status(400).json({ message: err.message }); }
});
router.patch("/:id", requirePermission("quotations", "edit"), async (req, res) => {
  try {
    const existing = await prisma.quotation.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!existing) return res.status(404).json({ message: "Not found" });

    const previousStatus = existing.status;
    const { prismaData, clientName } = parseQuotationBody(req.body);
    if (Object.keys(prismaData).length) {
      await prisma.quotation.updateMany({ where: { id: req.params.id, tenantId: req.tenantId }, data: prismaData });
    }

    let quotation = await prisma.quotation.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: QUOTATION_INCLUDE,
    });
    if (clientName || prismaData.leadId) {
      quotation = await resolveClientForQuotation(quotation, req.tenantId, { clientName });
    }
    quotation = await handleQuotationSentTransition(previousStatus, quotation, req.tenantId, req.userId, { clientName });
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

    let quotation = await prisma.quotation.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: QUOTATION_INCLUDE,
    });
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

    q = await resolveClientForQuotation(
      await prisma.quotation.findFirst({ where: { id: req.params.id, tenantId: req.tenantId }, include: QUOTATION_INCLUDE }),
      req.tenantId,
    );
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
