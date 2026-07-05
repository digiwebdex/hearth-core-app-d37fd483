// Generic CRUD factory for simple resources
const { authenticate, requirePermission, prisma } = require("../middleware/auth");
const router = require("express").Router;

const MODEL_MAP = {
  agent: "agent",
  task: "task",
  payment: "payment",
  transaction: "transaction",
  subscription: "subscription",
  paymentRequest: "paymentRequest",
  travelPackage: "travelPackage",
};

const PERMISSION_MODULE_MAP = {
  agent: "agents",
  task: "tasks",
  payment: "accounts",
  transaction: "accounts",
  subscription: "subscription",
  paymentRequest: "subscription",
  travelPackage: "packages",
};

const PACKAGE_CHILD_CONFIG = {
  days: {
    model: "travelPackageDay",
    orderBy: { dayNumber: "asc" },
    normalize: (items = []) => items
      .map((item, index) => ({
        dayNumber: Math.max(1, Number(item.dayNumber || index + 1)),
        title: String(item.title || `Day ${index + 1}`).trim(),
        description: item.description ? String(item.description) : null,
        overnightLocation: item.overnightLocation ? String(item.overnightLocation) : null,
      }))
      .filter((item) => item.title),
  },
  inclusions: {
    model: "travelPackageInclusion",
    orderBy: { sortOrder: "asc" },
    normalize: (items = []) => items
      .map((item, index) => ({
        type: String(item.type || "included").trim().toLowerCase() === "excluded" ? "excluded" : "included",
        label: String(item.label || "").trim(),
        sortOrder: Number(item.sortOrder ?? index),
      }))
      .filter((item) => item.label),
  },
  pricing: {
    model: "travelPackagePricing",
    orderBy: { travelerMin: "asc" },
    normalize: (items = [], body = {}) => items
      .map((item) => ({
        label: String(item.label || "Standard").trim(),
        travelerMin: Math.max(1, Number(item.travelerMin || 1)),
        travelerMax: item.travelerMax ? Number(item.travelerMax) : null,
        price: Number(item.price || 0),
        currency: String(item.currency || body.currency || "BDT").trim().toUpperCase(),
      }))
      .filter((item) => item.label),
  },
  media: {
    model: "travelPackageMedia",
    orderBy: { sortOrder: "asc" },
    normalize: (items = []) => items
      .map((item, index) => ({
        url: String(item.url || "").trim(),
        altText: item.altText ? String(item.altText) : null,
        sortOrder: Number(item.sortOrder ?? index),
      }))
      .filter((item) => item.url),
  },
};

const { slugify } = require("../lib/numeric");

function normalizeTravelPackagePayload(body = {}, tenantId, createdBy) {
  const title = String(body.title || "").trim();
  const code = String(body.code || "").trim().toUpperCase();
  if (!title) throw new Error("Package title is required");
  if (!code) throw new Error("Package code is required");

  const normalizedStatus = String(body.status || "draft").trim().toLowerCase();
  const status = ["draft", "published", "archived"].includes(normalizedStatus) ? normalizedStatus : "draft";

  return {
    base: {
      tenantId,
      serviceType: String(body.serviceType || "custom").trim().toLowerCase() || "custom",
      code,
      title,
      slug: slugify(body.slug || title),
      summary: body.summary ? String(body.summary) : null,
      destination: body.destination ? String(body.destination) : null,
      country: body.country ? String(body.country) : null,
      durationDays: Math.max(1, Number(body.durationDays || 1)),
      durationNights: Math.max(0, Number(body.durationNights || 0)),
      basePrice: Number(body.basePrice || 0),
      currency: String(body.currency || "BDT").trim().toUpperCase(),
      status,
      isFeatured: !!body.isFeatured,
      visaRequired: body.visaRequired === undefined ? null : !!body.visaRequired,
      cancellationPolicy: body.cancellationPolicy ? String(body.cancellationPolicy) : null,
      seasonalPricing: body.seasonalPricing ?? null,
      heroImage: body.heroImage ? String(body.heroImage) : null,
      createdBy: createdBy || null,
    },
    children: {
      days: PACKAGE_CHILD_CONFIG.days.normalize(body.days || []),
      inclusions: PACKAGE_CHILD_CONFIG.inclusions.normalize(body.inclusions || []),
      pricing: PACKAGE_CHILD_CONFIG.pricing.normalize(body.pricing || [], body),
      media: PACKAGE_CHILD_CONFIG.media.normalize(body.media || []),
    },
  };
}

function getTravelPackageInclude() {
  return {
    days: { orderBy: PACKAGE_CHILD_CONFIG.days.orderBy },
    inclusions: { orderBy: PACKAGE_CHILD_CONFIG.inclusions.orderBy },
    pricing: { orderBy: PACKAGE_CHILD_CONFIG.pricing.orderBy },
    media: { orderBy: PACKAGE_CHILD_CONFIG.media.orderBy },
  };
}

async function syncTravelPackageChildren(packageId, children) {
  await prisma.travelPackageDay.deleteMany({ where: { packageId } });
  await prisma.travelPackageInclusion.deleteMany({ where: { packageId } });
  await prisma.travelPackagePricing.deleteMany({ where: { packageId } });
  await prisma.travelPackageMedia.deleteMany({ where: { packageId } });

  if (children.days.length) {
    await prisma.travelPackageDay.createMany({ data: children.days.map((item) => ({ ...item, packageId })) });
  }
  if (children.inclusions.length) {
    await prisma.travelPackageInclusion.createMany({ data: children.inclusions.map((item) => ({ ...item, packageId })) });
  }
  if (children.pricing.length) {
    await prisma.travelPackagePricing.createMany({ data: children.pricing.map((item) => ({ ...item, packageId })) });
  }
  if (children.media.length) {
    await prisma.travelPackageMedia.createMany({ data: children.media.map((item) => ({ ...item, packageId })) });
  }
}

module.exports = function createCrudRouter(modelKey) {
  const r = router();
  const model = MODEL_MAP[modelKey] || modelKey;
  const permissionModule = PERMISSION_MODULE_MAP[modelKey] || PERMISSION_MODULE_MAP[model] || `${model}s`;
  const isTravelPackage = model === "travelPackage";

  r.use(authenticate);

  r.get("/", requirePermission(permissionModule, "view"), async (req, res) => {
    try {
      const where = { tenantId: req.tenantId };
      if (isTravelPackage) {
        if (req.query.status) where.status = String(req.query.status).toLowerCase();
        if (req.query.serviceType) where.serviceType = String(req.query.serviceType).toLowerCase();
      }

      const items = await prisma[model].findMany({
        where,
        orderBy: { createdAt: "desc" },
      });
      res.json(items);
    } catch (err) { res.status(500).json({ message: err.message }); }
  });

  r.get("/:id", requirePermission(permissionModule, "view"), async (req, res) => {
    try {
      const item = await prisma[model].findFirst({
        where: { id: req.params.id, tenantId: req.tenantId },
        ...(isTravelPackage ? { include: getTravelPackageInclude() } : {}),
      });
      if (!item) return res.status(404).json({ message: "Not found" });
      res.json(item);
    } catch (err) { res.status(500).json({ message: err.message }); }
  });

  if (isTravelPackage) {
    Object.entries(PACKAGE_CHILD_CONFIG).forEach(([routeName, config]) => {
      r.get(`/:id/${routeName}`, requirePermission(permissionModule, "view"), async (req, res) => {
        try {
          const pkg = await prisma.travelPackage.findFirst({ where: { id: req.params.id, tenantId: req.tenantId }, select: { id: true } });
          if (!pkg) return res.status(404).json({ message: "Not found" });
          const items = await prisma[config.model].findMany({ where: { packageId: req.params.id }, orderBy: config.orderBy });
          res.json(items);
        } catch (err) { res.status(500).json({ message: err.message }); }
      });

      r.post(`/:id/${routeName}`, requirePermission(permissionModule, "edit"), async (req, res) => {
        try {
          const pkg = await prisma.travelPackage.findFirst({ where: { id: req.params.id, tenantId: req.tenantId }, select: { id: true } });
          if (!pkg) return res.status(404).json({ message: "Not found" });
          const normalized = config.normalize([req.body], req.body)[0];
          if (!normalized) return res.status(400).json({ message: "Invalid item" });
          const created = await prisma[config.model].create({ data: { ...normalized, packageId: req.params.id } });
          res.status(201).json(created);
        } catch (err) { res.status(500).json({ message: err.message }); }
      });

      r.patch(`/:id/${routeName}/:childId`, requirePermission(permissionModule, "edit"), async (req, res) => {
        try {
          const pkg = await prisma.travelPackage.findFirst({ where: { id: req.params.id, tenantId: req.tenantId }, select: { id: true } });
          if (!pkg) return res.status(404).json({ message: "Not found" });
          const existing = await prisma[config.model].findFirst({ where: { id: req.params.childId, packageId: req.params.id } });
          if (!existing) return res.status(404).json({ message: "Not found" });
          const normalized = config.normalize([{ ...existing, ...req.body }], req.body)[0];
          if (!normalized) return res.status(400).json({ message: "Invalid item" });
          const updated = await prisma[config.model].update({ where: { id: req.params.childId }, data: normalized });
          res.json(updated);
        } catch (err) { res.status(500).json({ message: err.message }); }
      });

      r.delete(`/:id/${routeName}/:childId`, requirePermission(permissionModule, "edit"), async (req, res) => {
        try {
          const pkg = await prisma.travelPackage.findFirst({ where: { id: req.params.id, tenantId: req.tenantId }, select: { id: true } });
          if (!pkg) return res.status(404).json({ message: "Not found" });
          const result = await prisma[config.model].deleteMany({ where: { id: req.params.childId, packageId: req.params.id } });
          if (!result.count) return res.status(404).json({ message: "Not found" });
          res.json({ success: true });
        } catch (err) { res.status(500).json({ message: err.message }); }
      });
    });
  }

  r.post("/", requirePermission(permissionModule, "create"), async (req, res) => {
    try {
      if (isTravelPackage) {
        const payload = normalizeTravelPackagePayload(req.body, req.tenantId, req.userId);
        const item = await prisma.travelPackage.create({ data: payload.base });
        await syncTravelPackageChildren(item.id, payload.children);
        const created = await prisma.travelPackage.findFirst({
          where: { id: item.id, tenantId: req.tenantId },
          include: getTravelPackageInclude(),
        });
        return res.status(201).json(created);
      }

      const item = await prisma[model].create({ data: { ...req.body, tenantId: req.tenantId } });
      res.status(201).json(item);
    } catch (err) { res.status(500).json({ message: err.message }); }
  });

  r.patch("/:id", requirePermission(permissionModule, "edit"), async (req, res) => {
    try {
      if (isTravelPackage) {
        const existing = await prisma.travelPackage.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
        if (!existing) return res.status(404).json({ message: "Not found" });
        const payload = normalizeTravelPackagePayload({ ...existing, ...req.body }, req.tenantId, existing.createdBy || req.userId);
        await prisma.travelPackage.update({ where: { id: req.params.id }, data: payload.base });
        await syncTravelPackageChildren(req.params.id, payload.children);
        const updated = await prisma.travelPackage.findFirst({
          where: { id: req.params.id, tenantId: req.tenantId },
          include: getTravelPackageInclude(),
        });
        return res.json(updated);
      }

      const result = await prisma[model].updateMany({
        where: { id: req.params.id, tenantId: req.tenantId },
        data: req.body,
      });
      if (!result.count) return res.status(404).json({ message: "Not found" });
      const updated = await prisma[model].findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
      res.json(updated);
    } catch (err) { res.status(500).json({ message: err.message }); }
  });

  r.delete("/:id", requirePermission(permissionModule, "delete"), async (req, res) => {
    try {
      const result = await prisma[model].deleteMany({ where: { id: req.params.id, tenantId: req.tenantId } });
      if (!result.count) return res.status(404).json({ message: "Not found" });
      res.json({ success: true });
    } catch (err) { res.status(500).json({ message: err.message }); }
  });

  return r;
};
