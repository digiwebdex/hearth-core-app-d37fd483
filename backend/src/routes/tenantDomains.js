const router = require("express").Router();
const crypto = require("crypto");
const { authenticate, requireRole, prisma } = require("../middleware/auth");

const DOMAIN_PLAN_LIMITS = { free: 0, basic: 0, pro: 1, business: 2, enterprise: -1, unlimited: -1 };
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trial"]);

router.use(authenticate);
router.use(requireRole("tenant_owner"));

function generateToken() {
  return "tas-verify-" + crypto.randomBytes(12).toString("hex").slice(0, 16);
}

function normalizeDomain(rawDomain) {
  return String(rawDomain || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function getDomainLimit(plan) {
  return DOMAIN_PLAN_LIMITS[String(plan || "free").toLowerCase()] ?? 0;
}

function buildDefaultWebsiteUrl(req, slug) {
  const base = (process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
  return slug ? `${base}/site/${slug}` : base;
}

async function logDomainAudit(req, action, domain, extra = {}) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true, email: true, role: true } });
    await prisma.auditLog.create({
      data: {
        actorId: req.userId,
        actorName: user?.name || "Unknown",
        actorEmail: user?.email || "",
        actorRole: user?.role || req.userRole || "",
        tenantId: domain.tenantId || req.tenantId || null,
        module: "domains",
        action,
        targetType: "domain",
        targetId: domain.id,
        targetLabel: domain.domain,
        ipAddress: req.headers["x-forwarded-for"]?.toString()?.split(",")[0] || req.ip || null,
        ...extra,
      },
    });
  } catch (e) {
    console.error("Domain audit log error:", e.message);
  }
}

async function getTenantDomainSummary(req) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.tenantId },
    select: { id: true, name: true, slug: true, subscriptionPlan: true, subscriptionStatus: true },
  });
  if (!tenant) throw new Error("Tenant not found");

  const maxDomains = getDomainLimit(tenant.subscriptionPlan);
  const usedDomains = await prisma.tenantDomain.count({ where: { tenantId: tenant.id } });

  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    subscriptionPlan: tenant.subscriptionPlan,
    subscriptionStatus: tenant.subscriptionStatus,
    domainLimit: maxDomains,
    usedDomains,
    canAddDomain: ACTIVE_SUBSCRIPTION_STATUSES.has(String(tenant.subscriptionStatus || "").toLowerCase()) && (maxDomains === -1 || usedDomains < maxDomains),
    defaultWebsiteUrl: buildDefaultWebsiteUrl(req, tenant.slug),
  };
}

router.get("/summary", async (req, res) => {
  try {
    res.json(await getTenantDomainSummary(req));
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const domains = await prisma.tenantDomain.findMany({
      where: { tenantId: req.tenantId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    });
    res.json(domains);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { domain: rawDomain, wwwRedirect } = req.body || {};
    if (!rawDomain) return res.status(400).json({ message: "Domain is required" });

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: { id: true, subscriptionPlan: true, subscriptionStatus: true },
    });
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });

    const plan = String(tenant.subscriptionPlan || "free").toLowerCase();
    const subStatus = String(tenant.subscriptionStatus || "").toLowerCase();
    const maxDomains = getDomainLimit(plan);

    if (!ACTIVE_SUBSCRIPTION_STATUSES.has(subStatus)) {
      return res.status(403).json({ message: "Subscription must be active before adding custom domains" });
    }
    if (maxDomains === 0) return res.status(403).json({ message: "Current plan does not support custom domains" });

    const domain = normalizeDomain(rawDomain);
    if (!domain || domain.includes(" ") || !domain.includes(".")) return res.status(400).json({ message: "Invalid domain" });

    const existing = await prisma.tenantDomain.findUnique({ where: { domain } });
    if (existing) return res.status(409).json({ message: "Domain already registered" });

    const count = await prisma.tenantDomain.count({ where: { tenantId: req.tenantId } });
    if (maxDomains > 0 && count >= maxDomains) {
      return res.status(403).json({ message: `Domain limit reached (${maxDomains})` });
    }

    const created = await prisma.tenantDomain.create({
      data: {
        tenantId: req.tenantId,
        domain,
        wwwRedirect: wwwRedirect || "www-to-root",
        verificationToken: generateToken(),
        isPrimary: count === 0,
      },
    });

    await logDomainAudit(req, "tenant_create", created);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/:id/verify", async (req, res) => {
  try {
    const dom = await prisma.tenantDomain.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!dom) return res.status(404).json({ message: "Domain not found" });

    await prisma.tenantDomain.update({ where: { id: dom.id }, data: { verificationStatus: "verifying" } });

    const lookupDomain = `_verify.${dom.domain}`;
    let verified = false;
    try {
      const dnsRes = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(lookupDomain)}&type=TXT`);
      if (dnsRes.ok) {
        const data = await dnsRes.json();
        if (Array.isArray(data.Answer)) {
          verified = data.Answer.some((record) => String(record.data || "").replace(/^"|"$/g, "").trim() === dom.verificationToken);
        }
      }
    } catch (_err) {
      // ignore DNS provider errors
    }

    const updated = await prisma.tenantDomain.update({
      where: { id: dom.id },
      data: { verificationStatus: verified ? "verified" : "unverified", lastDnsCheck: new Date() },
    });

    await logDomainAudit(req, verified ? "tenant_verify" : "tenant_verify_failed", updated, { newValue: updated.verificationStatus });
    res.json({ verified, domain: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/:id/primary", async (req, res) => {
  try {
    const dom = await prisma.tenantDomain.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!dom) return res.status(404).json({ message: "Domain not found" });
    if (dom.verificationStatus !== "verified") return res.status(400).json({ message: "Verify the domain before setting it as primary" });

    await prisma.tenantDomain.updateMany({ where: { tenantId: req.tenantId }, data: { isPrimary: false } });
    const updated = await prisma.tenantDomain.update({ where: { id: dom.id }, data: { isPrimary: true } });

    await logDomainAudit(req, "tenant_set_primary", updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const dom = await prisma.tenantDomain.findFirst({ where: { id: req.params.id, tenantId: req.tenantId } });
    if (!dom) return res.status(404).json({ message: "Domain not found" });

    await prisma.tenantDomain.delete({ where: { id: dom.id } });
    if (dom.isPrimary) {
      const replacement = await prisma.tenantDomain.findFirst({ where: { tenantId: req.tenantId }, orderBy: { createdAt: "asc" } });
      if (replacement) {
        await prisma.tenantDomain.update({ where: { id: replacement.id }, data: { isPrimary: true } });
      }
    }

    await logDomainAudit(req, "tenant_delete", dom);
    res.json({ message: "Domain removed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;