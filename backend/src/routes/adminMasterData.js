const router = require("express").Router();
const { authenticate, requireSuperAdmin, prisma } = require("../middleware/auth");

const CATEGORIES = new Set([
  "country",
  "city",
  "airline",
  "airport",
  "university",
  "visa_type",
  "job_category",
  "vehicle_type",
  "hotel",
  "insurance_plan",
]);

function normalizeCategory(value) {
  return String(value || "").trim().toLowerCase();
}

function pickBody(body) {
  const data = {};
  if (body.category !== undefined) {
    const cat = normalizeCategory(body.category);
    if (!CATEGORIES.has(cat)) throw new Error(`Invalid category: ${body.category}`);
    data.category = cat;
  }
  if (body.code !== undefined) data.code = body.code ? String(body.code).trim().toUpperCase() : null;
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.nameBn !== undefined) data.nameBn = body.nameBn ? String(body.nameBn).trim() : null;
  if (body.parentId !== undefined) data.parentId = body.parentId ? String(body.parentId) : null;
  if (body.meta !== undefined) data.meta = body.meta && typeof body.meta === "object" ? body.meta : null;
  if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0;
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  return data;
}

router.use(authenticate);
router.use(requireSuperAdmin);

router.get("/", async (req, res) => {
  try {
    const category = normalizeCategory(req.query.category);
    const parentId = req.query.parentId ? String(req.query.parentId) : undefined;
    const search = String(req.query.search || "").trim();
    const where = {};
    if (category && CATEGORIES.has(category)) where.category = category;
    if (parentId) where.parentId = parentId;
    if (req.query.active === "1") where.isActive = true;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { nameBn: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ];
    }
    const items = await prisma.masterReference.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { parent: { select: { id: true, name: true, code: true, category: true } } },
    });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load master data" });
  }
});

router.get("/categories", (_req, res) => {
  res.json([...CATEGORIES]);
});

router.post("/", async (req, res) => {
  try {
    const data = pickBody(req.body);
    if (!data.category || !data.name) {
      return res.status(400).json({ message: "category and name are required" });
    }
    const item = await prisma.masterReference.create({ data });
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ message: err.message || "Failed to create" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const data = pickBody(req.body);
    if (!Object.keys(data).length) return res.status(400).json({ message: "No fields to update" });
    const item = await prisma.masterReference.update({ where: { id: req.params.id }, data });
    res.json(item);
  } catch (err) {
    res.status(400).json({ message: err.message || "Failed to update" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await prisma.masterReference.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message || "Failed to delete" });
  }
});

router.post("/seed", async (_req, res) => {
  try {
    const { seedMasterReferenceData } = require("../scripts/seed-master-data-lib");
    const result = await seedMasterReferenceData(prisma);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message || "Seed failed" });
  }
});

module.exports = router;
