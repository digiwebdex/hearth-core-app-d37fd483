// Shared backend numeric/string helpers. Consolidates copies that were
// duplicated across finance/route modules (docs/v2-master/104-Codebase-Review.md §4).

/** Round to 2 decimals (money). Was duplicated 5× across finance libs. */
function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/** URL-safe slug (lowercase, dash-separated, ≤80 chars). Was duplicated in blogs.js/crud.js. */
function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

module.exports = { round2, slugify };
