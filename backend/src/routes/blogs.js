const router = require("express").Router();
const { authenticate, requirePermission, requireFeature, prisma } = require("../middleware/auth");

router.use(authenticate);
router.use(requireFeature("hasWebsiteTemplates"));

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function uniqueSlug(tenantId, base, excludeId) {
  let slug = base || "post";
  let n = 0;
  while (true) {
    const candidate = n ? `${slug}-${n}` : slug;
    const existing = await prisma.websitePost.findFirst({
      where: { tenantId, slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    });
    if (!existing) return candidate;
    n += 1;
  }
}

router.get("/", requirePermission("website", "view"), async (req, res) => {
  try {
    const where = { tenantId: req.tenantId };
    if (req.query.status) where.status = String(req.query.status);
    const posts = await prisma.websitePost.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", requirePermission("website", "view"), async (req, res) => {
  try {
    const post = await prisma.websitePost.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!post) return res.status(404).json({ message: "Not found" });
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", requirePermission("website", "create"), async (req, res) => {
  try {
    const title = String(req.body.title || "").trim();
    if (!title) return res.status(400).json({ message: "Title is required" });

    const status = req.body.status === "published" ? "published" : "draft";
    const slug = await uniqueSlug(req.tenantId, slugify(req.body.slug || title));
    const publishedAt = status === "published" ? new Date(req.body.publishedAt || Date.now()) : null;

    const post = await prisma.websitePost.create({
      data: {
        tenantId: req.tenantId,
        slug,
        title,
        excerpt: String(req.body.excerpt || "").trim(),
        body: String(req.body.body || "").trim(),
        coverImage: req.body.coverImage ? String(req.body.coverImage).trim() : null,
        status,
        publishedAt,
        authorName: req.body.authorName ? String(req.body.authorName).trim() : null,
      },
    });
    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/:id", requirePermission("website", "edit"), async (req, res) => {
  try {
    const existing = await prisma.websitePost.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!existing) return res.status(404).json({ message: "Not found" });

    const data = {};
    if (req.body.title !== undefined) data.title = String(req.body.title).trim();
    if (req.body.excerpt !== undefined) data.excerpt = String(req.body.excerpt).trim();
    if (req.body.body !== undefined) data.body = String(req.body.body).trim();
    if (req.body.coverImage !== undefined) data.coverImage = req.body.coverImage ? String(req.body.coverImage).trim() : null;
    if (req.body.authorName !== undefined) data.authorName = req.body.authorName ? String(req.body.authorName).trim() : null;
    if (req.body.slug !== undefined) {
      data.slug = await uniqueSlug(req.tenantId, slugify(req.body.slug), existing.id);
    }
    if (req.body.status !== undefined) {
      const status = req.body.status === "published" ? "published" : "draft";
      data.status = status;
      if (status === "published" && !existing.publishedAt) {
        data.publishedAt = new Date(req.body.publishedAt || Date.now());
      }
      if (status === "draft") data.publishedAt = null;
    }

    const post = await prisma.websitePost.update({ where: { id: existing.id }, data });
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", requirePermission("website", "delete"), async (req, res) => {
  try {
    const result = await prisma.websitePost.deleteMany({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!result.count) return res.status(404).json({ message: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
