/** Internal platform tenant(s) — not customer agencies. */

const PLATFORM_SLUGS = new Set(["platform-admin", "tawss-platform"]);
const PLATFORM_NAMES = new Set(["platform admin", "tawss platform"]);

function isPlatformTenant(tenant) {
  if (!tenant) return false;
  const slug = String(tenant.slug || "").toLowerCase();
  const name = String(tenant.name || "").toLowerCase();
  return PLATFORM_SLUGS.has(slug) || PLATFORM_NAMES.has(name);
}

module.exports = { isPlatformTenant };
