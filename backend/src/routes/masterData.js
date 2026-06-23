const router = require("express").Router();
const { authenticate, prisma } = require("../middleware/auth");

const ALLOWED = new Set([
  "country", "city", "airline", "airport", "university", "visa_type", "job_category", "vehicle_type",
]);

router.use(authenticate);

router.get("/", async (req, res) => {
  try {
    const category = String(req.query.category || "").trim().toLowerCase();
    if (!ALLOWED.has(category)) {
      return res.status(400).json({ message: "Valid category query param is required" });
    }
    const parentId = req.query.parentId ? String(req.query.parentId) : undefined;
    const search = String(req.query.search || "").trim();
    const where = { category, isActive: true };
    if (parentId) where.parentId = parentId;
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
      select: { id: true, category: true, code: true, name: true, nameBn: true, parentId: true, meta: true, sortOrder: true },
    });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load reference data" });
  }
});

module.exports = router;
