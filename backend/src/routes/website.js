const fs = require("fs");
const path = require("path");
const router = require("express").Router();
const { authenticate, requirePermission, prisma } = require("../middleware/auth");

const ALLOWED_ASSET_TYPES = new Set(["logo", "hero", "about", "gallery"]);
const ALLOWED_MIME_TYPES = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};
const MAX_ASSET_SIZE_BYTES = 8 * 1024 * 1024;
const WEBSITE_UPLOAD_DIR = path.join(__dirname, "../../uploads/website-assets");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseNotes(notes) {
  if (!notes || typeof notes !== "string") return {};
  const trimmed = notes.trim();
  if (!trimmed) return {};
  if (!trimmed.startsWith("{")) return { legacyNotes: notes };
  try { return JSON.parse(trimmed); }
  catch { return { legacyNotes: notes }; }
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
    createSection("services", "Services", 2, {
      title: "Our Services",
      badge: "What We Offer",
    }, content.services || []),
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
    createSection("why-choose-us", "Why Choose Us", 4, {
      title: "Why Choose Us",
      badge: "Why Us",
    }, content.whyChooseUs || []),
    createSection("testimonials", "Testimonials", 5, {
      title: "Testimonials",
      badge: "Testimonials",
    }, content.testimonials || []),
    createSection("faq", "FAQ", 6, {
      title: "FAQ",
      badge: "FAQ",
    }, content.faq || []),
    createSection("team", "Team", 7, {
      title: "Our Team",
      badge: "Team",
    }, content.team || []),
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

function applyCmsToLegacy(config) {
  const next = clone(config || {});
  const sections = Array.isArray(next?.cms?.sections)
    ? next.cms.sections.map((section, index) => ensureSectionShape(section, index))
    : [];
  const findSection = (type) => sections.find((section) => section.type === type);

  const hero = findSection("hero");
  const about = findSection("about");
  const services = findSection("services");
  const featuredPackages = findSection("featured-packages");
  const whyChooseUs = findSection("why-choose-us");
  const testimonials = findSection("testimonials");
  const faq = findSection("faq");
  const team = findSection("team");
  const cta = findSection("cta");
  const contact = findSection("contact");

  next.content = next.content || {};
  if (hero) {
    next.content.heroBadge = hero.fields.badge || next.content.heroBadge || "";
    next.content.heroTitle = hero.fields.title || next.content.heroTitle || "";
    next.content.heroSubtitle = hero.fields.subtitle || next.content.heroSubtitle || "";
    next.content.heroImage = hero.fields.image || next.content.heroImage || "";
  }
  if (about) {
    next.content.aboutTitle = about.fields.title || next.content.aboutTitle || "";
    next.content.aboutText = about.fields.text || next.content.aboutText || "";
    next.content.aboutImage = about.fields.image || next.content.aboutImage || "";
  }
  if (services) next.content.services = Array.isArray(services.items) ? services.items : next.content.services || [];
  if (featuredPackages) {
    next.content.packagesBadge = featuredPackages.fields.badge || next.content.packagesBadge || "";
    next.content.packagesTitle = featuredPackages.fields.title || next.content.packagesTitle || "";
    next.content.packagesSubtitle = featuredPackages.fields.subtitle || next.content.packagesSubtitle || "";
    next.content.packagePageTitle = featuredPackages.fields.pageTitle || next.content.packagePageTitle || "";
    next.content.packagePageSubtitle = featuredPackages.fields.pageSubtitle || next.content.packagePageSubtitle || "";
    next.content.packagePrimaryButtonText = featuredPackages.fields.primaryButtonText || next.content.packagePrimaryButtonText || "";
    next.content.packageSecondaryButtonText = featuredPackages.fields.secondaryButtonText || next.content.packageSecondaryButtonText || "";
  }
  if (whyChooseUs) next.content.whyChooseUs = Array.isArray(whyChooseUs.items) ? whyChooseUs.items : next.content.whyChooseUs || [];
  if (testimonials) next.content.testimonials = Array.isArray(testimonials.items) ? testimonials.items : next.content.testimonials || [];
  if (faq) next.content.faq = Array.isArray(faq.items) ? faq.items : next.content.faq || [];
  if (team) next.content.team = Array.isArray(team.items) ? team.items : next.content.team || [];
  if (cta) {
    next.content.ctaTitle = cta.fields.title || next.content.ctaTitle || "";
    next.content.ctaSubtitle = cta.fields.subtitle || next.content.ctaSubtitle || "";
  }
  if (contact) {
    next.contactInfo = {
      ...(next.contactInfo || {}),
      phone: contact.fields.phone || next.contactInfo?.phone || "",
      email: contact.fields.email || next.contactInfo?.email || "",
      address: contact.fields.address || next.contactInfo?.address || "",
      mapEmbed: contact.fields.mapEmbed || next.contactInfo?.mapEmbed || "",
    };
    next.socialLinks = {
      ...(next.socialLinks || {}),
      facebook: contact.fields.facebook || next.socialLinks?.facebook || "",
      instagram: contact.fields.instagram || next.socialLinks?.instagram || "",
      twitter: contact.fields.twitter || next.socialLinks?.twitter || "",
      whatsapp: contact.fields.whatsapp || next.socialLinks?.whatsapp || "",
      youtube: contact.fields.youtube || next.socialLinks?.youtube || "",
    };
  }

  next.cms = {
    version: 1,
    sections: sections
      .sort((a, b) => a.order - b.order)
      .map((section, index) => ({ ...ensureSectionShape(section, index), order: index })),
  };

  return next;
}

function normalizeWebsiteConfig(config) {
  const next = clone(config || {});
  if (!next.cms || !Array.isArray(next.cms.sections) || !next.cms.sections.length) {
    next.cms = { version: 1, sections: buildSectionsFromLegacy(next) };
  }
  return applyCmsToLegacy(next);
}

function validateWebsiteConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return "Website config must be an object";
  }
  if (!config.template || typeof config.template !== "string") {
    return "Website template is required";
  }
  if (!config.colors || typeof config.colors !== "object") {
    return "Website colors are required";
  }
  if (!config.content || typeof config.content !== "object") {
    return "Website content is required";
  }
  return null;
}

function parseAssetPayload(body = {}) {
  const rawData = String(body.dataUrl || body.base64 || "").trim();
  if (!rawData) throw new Error("Image data is required");

  let mimeType = String(body.contentType || "").trim().toLowerCase();
  let encoded = rawData;
  const match = rawData.match(/^data:(.+?);base64,(.+)$/);
  if (match) {
    mimeType = mimeType || match[1].toLowerCase();
    encoded = match[2];
  }

  const extension = ALLOWED_MIME_TYPES[mimeType];
  if (!extension) throw new Error("Only PNG, JPG, JPEG, WEBP, or SVG images are allowed");

  const buffer = Buffer.from(encoded, "base64");
  if (!buffer.length) throw new Error("Invalid image data");
  if (buffer.length > MAX_ASSET_SIZE_BYTES) throw new Error("Image must be 8 MB or smaller");

  return { extension, buffer };
}

function sanitizeBaseName(value) {
  return String(value || "website-asset")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50) || "website-asset";
}

function ensureUploadDirectory(tenantId) {
  const tenantDir = path.join(WEBSITE_UPLOAD_DIR, tenantId);
  fs.mkdirSync(tenantDir, { recursive: true });
  return tenantDir;
}

function buildAssetResponse(req, tenantId, fileName) {
  const apiBase = (process.env.API_BASE_URL || `${req.protocol}://${req.get("host")}/api`).replace(/\/$/, "");
  const origin = apiBase.endsWith("/api") ? apiBase.slice(0, -4) : apiBase;
  return {
    assetUrl: `${origin}/uploads/website-assets/${tenantId}/${fileName}`,
    fileName,
  };
}

async function getTenantNotes(tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { notes: true },
  });
  if (!tenant) return null;
  return parseNotes(tenant.notes);
}

async function saveWebsiteConfig(tenantId, config) {
  const notes = await getTenantNotes(tenantId);
  if (!notes) return null;
  const normalized = normalizeWebsiteConfig(config);
  notes.websiteConfig = normalized;
  if (normalized.socialLinks) notes.socialLinks = normalized.socialLinks;

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { notes: JSON.stringify(notes) },
  });

  return normalized;
}

router.use(authenticate);

router.post("/upload-asset", requirePermission("website", "edit"), async (req, res) => {
  try {
    if (!req.tenantId) return res.status(400).json({ message: "Tenant context required" });
    const assetType = String(req.body?.assetType || "").trim().toLowerCase();
    if (!ALLOWED_ASSET_TYPES.has(assetType)) return res.status(400).json({ message: "Invalid asset type" });

    const { extension, buffer } = parseAssetPayload(req.body || {});
    const tenantDir = ensureUploadDirectory(req.tenantId);
    const baseName = sanitizeBaseName(req.body?.fileName || `${assetType}-image`);
    const fileName = `${assetType}-${Date.now()}-${baseName}${extension}`;
    fs.writeFileSync(path.join(tenantDir, fileName), buffer);

    res.status(201).json(buildAssetResponse(req, req.tenantId, fileName));
  } catch (err) {
    console.error("website/upload-asset POST error", err);
    res.status(400).json({ message: err.message || "Upload failed" });
  }
});

router.get("/config", requirePermission("website", "view"), async (req, res) => {
  try {
    if (!req.tenantId) return res.status(400).json({ message: "Tenant context required" });
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: { notes: true },
    });
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });

    const config = parseNotes(tenant.notes).websiteConfig;
    if (!config) return res.status(404).json({ message: "Website config not found" });
    res.json(normalizeWebsiteConfig(config));
  } catch (err) {
    console.error("website/config GET error", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/config", requirePermission("website", "edit"), async (req, res) => {
  try {
    if (!req.tenantId) return res.status(400).json({ message: "Tenant context required" });
    const normalized = normalizeWebsiteConfig(req.body);
    const validationError = validateWebsiteConfig(normalized);
    if (validationError) return res.status(400).json({ message: validationError });

    const saved = await saveWebsiteConfig(req.tenantId, normalized);
    if (!saved) return res.status(404).json({ message: "Tenant not found" });
    res.json(saved);
  } catch (err) {
    console.error("website/config POST error", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/sections", requirePermission("website", "view"), async (req, res) => {
  try {
    if (!req.tenantId) return res.status(400).json({ message: "Tenant context required" });
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId }, select: { notes: true } });
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });

    const config = normalizeWebsiteConfig(parseNotes(tenant.notes).websiteConfig || {});
    res.json(config.cms?.sections || []);
  } catch (err) {
    console.error("website/sections GET error", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/sections", requirePermission("website", "edit"), async (req, res) => {
  try {
    if (!req.tenantId) return res.status(400).json({ message: "Tenant context required" });
    const { type, label, enabled = true, fields = {}, items = [] } = req.body || {};
    if (!type || typeof type !== "string") return res.status(400).json({ message: "Section type is required" });

    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId }, select: { notes: true } });
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });
    const config = normalizeWebsiteConfig(parseNotes(tenant.notes).websiteConfig || {});
    const sections = Array.isArray(config.cms?.sections) ? config.cms.sections : [];
    sections.push(ensureSectionShape({
      id: `${type}-${Date.now()}`,
      type,
      label: label || type,
      enabled,
      order: sections.length,
      fields,
      items,
    }, sections.length));
    config.cms.sections = sections.map((section, index) => ({ ...ensureSectionShape(section, index), order: index }));

    const saved = await saveWebsiteConfig(req.tenantId, config);
    res.status(201).json(saved.cms.sections);
  } catch (err) {
    console.error("website/sections POST error", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/sections/:sectionId", requirePermission("website", "edit"), async (req, res) => {
  try {
    if (!req.tenantId) return res.status(400).json({ message: "Tenant context required" });
    const sectionId = String(req.params.sectionId || "");
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId }, select: { notes: true } });
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });

    const config = normalizeWebsiteConfig(parseNotes(tenant.notes).websiteConfig || {});
    const sections = Array.isArray(config.cms?.sections) ? config.cms.sections : [];
    const index = sections.findIndex((section) => String(section.id) === sectionId);
    if (index === -1) return res.status(404).json({ message: "Section not found" });

    sections[index] = ensureSectionShape({
      ...sections[index],
      ...req.body,
      fields: req.body?.fields && typeof req.body.fields === "object" ? { ...(sections[index].fields || {}), ...req.body.fields } : sections[index].fields,
      items: Array.isArray(req.body?.items) ? req.body.items : sections[index].items,
    }, index);
    config.cms.sections = sections.map((section, order) => ({ ...ensureSectionShape(section, order), order }));

    const saved = await saveWebsiteConfig(req.tenantId, config);
    res.json(saved.cms.sections[index]);
  } catch (err) {
    console.error("website/sections PATCH error", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/sections/reorder", requirePermission("website", "edit"), async (req, res) => {
  try {
    if (!req.tenantId) return res.status(400).json({ message: "Tenant context required" });
    const sectionIds = Array.isArray(req.body?.sectionIds) ? req.body.sectionIds.map((value) => String(value)) : [];
    if (!sectionIds.length) return res.status(400).json({ message: "sectionIds array is required" });

    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId }, select: { notes: true } });
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });

    const config = normalizeWebsiteConfig(parseNotes(tenant.notes).websiteConfig || {});
    const current = Array.isArray(config.cms?.sections) ? config.cms.sections : [];
    const byId = new Map(current.map((section) => [String(section.id), section]));
    const reordered = sectionIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .concat(current.filter((section) => !sectionIds.includes(String(section.id))));

    config.cms.sections = reordered.map((section, order) => ({ ...ensureSectionShape(section, order), order }));
    const saved = await saveWebsiteConfig(req.tenantId, config);
    res.json(saved.cms.sections);
  } catch (err) {
    console.error("website/sections/reorder POST error", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/sections/:sectionId", requirePermission("website", "edit"), async (req, res) => {
  try {
    if (!req.tenantId) return res.status(400).json({ message: "Tenant context required" });
    const sectionId = String(req.params.sectionId || "");
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId }, select: { notes: true } });
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });

    const config = normalizeWebsiteConfig(parseNotes(tenant.notes).websiteConfig || {});
    const nextSections = (config.cms?.sections || []).filter((section) => String(section.id) !== sectionId);
    config.cms.sections = nextSections.map((section, order) => ({ ...ensureSectionShape(section, order), order }));

    const saved = await saveWebsiteConfig(req.tenantId, config);
    res.json(saved.cms.sections);
  } catch (err) {
    console.error("website/sections DELETE error", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;