/**
 * Public tenant API - no auth required.
 * Used by tenant marketing sites, custom-domain landing pages,
 * and the website customizer's public preview.
 */
const router = require("express").Router();
const { prisma } = require("../middleware/auth");

const DOMAIN_ENABLED_PLANS = new Set(["pro", "business", "enterprise", "unlimited"]);
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trial"]);

// Strip protocol, www., trailing slash/path, lowercase.
function normalizeDomain(d) {
  return String(d || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseTenantNotes(notes) {
  if (!notes || typeof notes !== "string" || !notes.trim().startsWith("{")) return {};
  try { return JSON.parse(notes); }
  catch { return {}; }
}

function createSection(type, label, order, fields = {}, items = []) {
  return {
    id: `${type}-${order + 1}`,
    type,
    label,
    enabled: true,
    order,
    fields,
    items,
  };
}

function ensureSectionShape(section, fallbackOrder = 0) {
  return {
    id: String(section?.id || `${section?.type || "section"}-${fallbackOrder + 1}`),
    type: String(section?.type || "custom"),
    label: String(section?.label || section?.type || "Section"),
    enabled: section?.enabled !== false,
    order: Number.isFinite(section?.order) ? Number(section.order) : fallbackOrder,
    fields: section?.fields && typeof section.fields === "object" && !Array.isArray(section.fields) ? section.fields : {},
    items: Array.isArray(section?.items) ? section.items : [],
  };
}

function buildSectionsFromLegacy(config) {
  const content = config?.content || {};
  return [
    createSection("hero", "Hero", 0, {
      badge: content.heroBadge || "",
      title: content.heroTitle || "",
      subtitle: content.heroSubtitle || "",
      image: content.heroImage || "",
      primaryButtonText: content.packageSecondaryButtonText || "View Packages",
      primaryButtonLink: "/site/packages",
      secondaryButtonText: "Contact Us",
      secondaryButtonLink: "/site/contact",
    }),
    createSection("about", "About", 1, {
      title: content.aboutTitle || "",
      text: content.aboutText || "",
      image: content.aboutImage || "",
      badge: "About Us",
    }),
    createSection("services", "Services", 2, { title: "Our Services", badge: "What We Offer" }, content.services || []),
    createSection("featured-packages", "Featured Packages", 3, {
      badge: content.packagesBadge || "Popular Packages",
      title: content.packagesTitle || "Featured Packages",
      subtitle: content.packagesSubtitle || "",
      pageTitle: content.packagePageTitle || "Our Packages",
      pageSubtitle: content.packagePageSubtitle || "",
      primaryButtonText: content.packagePrimaryButtonText || "Book Now",
      secondaryButtonText: content.packageSecondaryButtonText || "View All Packages",
      secondaryButtonLink: "/site/packages",
    }),
    createSection("why-choose-us", "Why Choose Us", 4, { title: "Why Choose Us", badge: "Why Us" }, content.whyChooseUs || []),
    createSection("testimonials", "Testimonials", 5, { title: "Testimonials", badge: "Testimonials" }, content.testimonials || []),
    createSection("faq", "FAQ", 6, { title: "FAQ", badge: "FAQ" }, content.faq || []),
    createSection("team", "Team", 7, { title: "Our Team", badge: "Team" }, content.team || []),
    createSection("cta", "Call To Action", 8, {
      title: content.ctaTitle || "",
      subtitle: content.ctaSubtitle || "",
      primaryButtonText: content.packageSecondaryButtonText || "View Packages",
      primaryButtonLink: "/site/packages",
      secondaryButtonText: "Contact Us",
      secondaryButtonLink: "/site/contact",
    }),
    createSection("contact", "Contact", 9, {
      title: "Contact Us",
      phone: config?.contactInfo?.phone || "",
      email: config?.contactInfo?.email || "",
      address: config?.contactInfo?.address || "",
      mapEmbed: config?.contactInfo?.mapEmbed || "",
      facebook: config?.socialLinks?.facebook || "",
      instagram: config?.socialLinks?.instagram || "",
      twitter: config?.socialLinks?.twitter || "",
      whatsapp: config?.socialLinks?.whatsapp || "",
      youtube: config?.socialLinks?.youtube || "",
    }),
  ];
}

function normalizeWebsiteConfig(config) {
  const next = clone(config || {});
  next.content = next.content || {};
  if (!next.cms || !Array.isArray(next.cms.sections) || !next.cms.sections.length) {
    next.cms = { version: 1, sections: buildSectionsFromLegacy(next) };
  }
  next.cms.sections = next.cms.sections
    .map((section, index) => ensureSectionShape(section, index))
    .sort((a, b) => a.order - b.order)
    .map((section, index) => ({ ...section, order: index }));
  return next;
}

function tenantCanUseCustomDomain(tenant) {
  const plan = String(tenant?.subscriptionPlan || "").toLowerCase();
  const status = String(tenant?.subscriptionStatus || "").toLowerCase();
  return DOMAIN_ENABLED_PLANS.has(plan) && ACTIVE_SUBSCRIPTION_STATUSES.has(status);
}

async function findReadyDomain(domain) {
  const record = await prisma.tenantDomain.findFirst({
    where: { domain, status: "active", verificationStatus: "verified" },
    include: { tenant: true },
  });
  if (!record?.tenant || !tenantCanUseCustomDomain(record.tenant)) return null;
  return record;
}

function getWebsiteConfig(tenant) {
  const notes = parseTenantNotes(tenant?.notes);
  return notes.websiteConfig ? normalizeWebsiteConfig(notes.websiteConfig) : null;
}

// Map a Tenant DB row to the public-safe shape the frontend expects.
function publicTenant(t) {
  if (!t) return null;
  const notes = parseTenantNotes(t.notes);
  return {
    id: t.id,
    name: t.name,
    slug: t.slug || t.id,
    logo: getWebsiteConfig(t)?.logo || undefined,
    description: getWebsiteConfig(t)?.content?.heroSubtitle || undefined,
    phone: t.phone || undefined,
    email: undefined,
    address: [t.address, t.city, t.country].filter(Boolean).join(", ") || undefined,
    website: t.website || undefined,
    socialLinks: notes.socialLinks || getWebsiteConfig(t)?.socialLinks || undefined,
  };
}

function publicHajjPackage(p) {
  let highlights = [];
  if (p.highlights) {
    try { highlights = JSON.parse(p.highlights); }
    catch { highlights = String(p.highlights).split("\n").map((s) => s.trim()).filter(Boolean); }
  }
  return {
    id: p.id,
    name: p.name,
    description: p.notes || "",
    price: p.packagePrice || 0,
    duration: p.duration || "",
    image: undefined,
    type: p.type || "umrah",
    highlights,
    source: "hajj",
  };
}

function mapTravelPackageType(value) {
  switch (String(value || "").toLowerCase()) {
    case "tour_domestic":
      return "domestic tour";
    case "tour_international":
      return "international tour";
    case "air_ticket":
      return "air ticket";
    case "hotel":
      return "hotel";
    case "transport":
      return "transport";
    case "visa":
      return "visa";
    case "hajj_umrah":
      return "hajj / umrah";
    default:
      return String(value || "custom").replace(/_/g, " ");
  }
}

function publicTravelPackage(p) {
  const includedHighlights = Array.isArray(p.inclusions)
    ? p.inclusions
        .filter((item) => item.type === "included")
        .slice(0, 4)
        .map((item) => item.label)
    : [];
  const dayHighlights = Array.isArray(p.days)
    ? p.days
        .slice(0, Math.max(0, 4 - includedHighlights.length))
        .map((item) => item.title)
    : [];
  const highlights = [...includedHighlights, ...dayHighlights].filter(Boolean);
  return {
    id: p.id,
    name: p.title,
    description: p.summary || "",
    price: p.basePrice || 0,
    duration: `${p.durationDays || 1} Days / ${p.durationNights || 0} Nights`,
    image: p.heroImage || p.media?.[0]?.url || undefined,
    type: mapTravelPackageType(p.serviceType),
    highlights,
    source: "travel_package",
    isFeatured: !!p.isFeatured,
    visaRequired: !!p.visaRequired,
    cancellationPolicy: p.cancellationPolicy || undefined,
    serviceType: p.serviceType || undefined,
  };
}

async function getPublicPackagesByTenantId(tenantId, { featuredOnly = false } = {}) {
  const travelWhere = { tenantId, status: "published" };
  if (featuredOnly) travelWhere.isFeatured = true;

  const [travelPackages, hajjPackages] = await Promise.all([
    prisma.travelPackage.findMany({
      where: travelWhere,
      include: {
        days: { orderBy: { dayNumber: "asc" } },
        inclusions: { orderBy: { sortOrder: "asc" } },
        media: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    }).catch(() => []),
    prisma.hajjPackage.findMany({
      where: { tenantId, status: { not: "archived" } },
      orderBy: { createdAt: "desc" },
    }).catch(() => []),
  ]);

  return [
    ...travelPackages.map(publicTravelPackage),
    ...hajjPackages.map(publicHajjPackage),
  ];
}

// GET /api/public/:slug - tenant by slug
router.get("/:slug", async (req, res) => {
  try {
    const slug = String(req.params.slug || "").toLowerCase();
    if (!slug) return res.status(400).json({ message: "Slug required" });
    const tenant = await prisma.tenant.findFirst({ where: { slug } });
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });
    res.json(publicTenant(tenant));
  } catch (e) {
    console.error("public/:slug error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/public/:slug/packages - tenant packages by slug
router.get("/:slug/packages", async (req, res) => {
  try {
    const slug = String(req.params.slug || "").toLowerCase();
    const tenant = await prisma.tenant.findFirst({ where: { slug }, select: { id: true } });
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });
    const packages = await getPublicPackagesByTenantId(tenant.id, {
      featuredOnly: String(req.query.featured || "").toLowerCase() === "true",
    });
    res.json(packages);
  } catch (e) {
    console.error("public/:slug/packages error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/public/:slug/blog-posts - published blog posts
router.get("/:slug/blog-posts", async (req, res) => {
  try {
    const slug = String(req.params.slug || "").toLowerCase();
    const tenant = await prisma.tenant.findFirst({ where: { slug } });
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });
    const posts = await prisma.websitePost.findMany({
      where: { tenantId: tenant.id, status: "published" },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        coverImage: true,
        publishedAt: true,
        authorName: true,
      },
    });
    res.json(posts);
  } catch (e) {
    console.error("public/:slug/blog-posts error", e);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:slug/blog-posts/:postSlug", async (req, res) => {
  try {
    const slug = String(req.params.slug || "").toLowerCase();
    const postSlug = String(req.params.postSlug || "").toLowerCase();
    const tenant = await prisma.tenant.findFirst({ where: { slug } });
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });
    const post = await prisma.websitePost.findFirst({
      where: { tenantId: tenant.id, slug: postSlug, status: "published" },
    });
    if (!post) return res.status(404).json({ message: "Post not found" });
    res.json(post);
  } catch (e) {
    console.error("public/:slug/blog-posts/:postSlug error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/public/:slug/website - saved website config by slug
router.get("/:slug/website", async (req, res) => {
  try {
    const slug = String(req.params.slug || "").toLowerCase();
    const tenant = await prisma.tenant.findFirst({ where: { slug } });
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });
    const config = getWebsiteConfig(tenant);
    if (!config) return res.status(404).json({ message: "Website config not found" });
    res.json(config);
  } catch (e) {
    console.error("public/:slug/website error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/public/domain/:domain - tenant by custom domain
router.get("/domain/:domain", async (req, res) => {
  try {
    const domain = normalizeDomain(req.params.domain);
    if (!domain) return res.status(400).json({ message: "Domain required" });
    const record = await findReadyDomain(domain);
    if (!record?.tenant) return res.status(404).json({ message: "Domain not found" });
    res.json(publicTenant(record.tenant));
  } catch (e) {
    console.error("public/domain/:domain error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/public/domain/:domain/packages - packages by custom domain
router.get("/domain/:domain/packages", async (req, res) => {
  try {
    const domain = normalizeDomain(req.params.domain);
    const record = await findReadyDomain(domain);
    if (!record) return res.status(404).json({ message: "Domain not found" });
    const packages = await getPublicPackagesByTenantId(record.tenantId, {
      featuredOnly: String(req.query.featured || "").toLowerCase() === "true",
    });
    res.json(packages);
  } catch (e) {
    console.error("public/domain/:domain/packages error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/public/domain/:domain/website - saved website config by custom domain
router.get("/domain/:domain/website", async (req, res) => {
  try {
    const domain = normalizeDomain(req.params.domain);
    const record = await findReadyDomain(domain);
    if (!record?.tenant) return res.status(404).json({ message: "Domain not found" });
    const config = getWebsiteConfig(record.tenant);
    if (!config) return res.status(404).json({ message: "Website config not found" });
    res.json(config);
  } catch (e) {
    console.error("public/domain/:domain/website error", e);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/public/sitemap/:slug — generate sitemap XML for a tenant site
router.get("/sitemap/:slug", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst({
      where: { slug: req.params.slug },
      select: { id: true, slug: true },
    });
    if (!tenant) return res.status(404).send("Not found");

    const [packages, posts] = await Promise.all([
      prisma.travelPackage.findMany({
        where: { tenantId: tenant.id, status: "published" },
        select: { slug: true, updatedAt: true },
      }),
      prisma.websitePost.findMany({
        where: { tenantId: tenant.id, status: "published" },
        select: { slug: true, updatedAt: true },
      }),
    ]);

    const baseUrl = `https://${tenant.slug}.travelagencyweb.com`;
    const formatDate = (d) => new Date(d).toISOString().slice(0, 10);

    const urls = [
      `<url><loc>${baseUrl}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
      `<url><loc>${baseUrl}/packages</loc><changefreq>daily</changefreq><priority>0.9</priority></url>`,
      `<url><loc>${baseUrl}/about</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>`,
      `<url><loc>${baseUrl}/contact</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>`,
      ...packages.map((p) => `<url><loc>${baseUrl}/packages/${p.slug}</loc><lastmod>${formatDate(p.updatedAt)}</lastmod><priority>0.8</priority></url>`),
      ...posts.map((p) => `<url><loc>${baseUrl}/blog/${p.slug}</loc><lastmod>${formatDate(p.updatedAt)}</lastmod><priority>0.6</priority></url>`),
    ];

    res.set("Content-Type", "application/xml");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`);
  } catch (e) {
    console.error("sitemap error", e);
    res.status(500).send("Server error");
  }
});

// GET /api/public/robots/:slug — robots.txt for a tenant
router.get("/robots/:slug", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findFirst({
      where: { slug: req.params.slug },
      select: { slug: true },
    });
    if (!tenant) return res.status(404).send("Not found");
    const baseUrl = `https://${tenant.slug}.travelagencyweb.com`;
    res.set("Content-Type", "text/plain");
    res.send(`User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml`);
  } catch (e) {
    res.status(500).send("Server error");
  }
});

module.exports = router;
