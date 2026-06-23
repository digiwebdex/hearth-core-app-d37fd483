const { ALL_SUBCATEGORY_IDS } = require("./serviceCatalogIds");

function normalizeEnabledSubcategories(values) {
  if (!values?.length) return [];
  const valid = new Set(ALL_SUBCATEGORY_IDS);
  return [...new Set(values.map((v) => String(v).trim()).filter((id) => valid.has(id)))];
}

module.exports = { normalizeEnabledSubcategories, ALL_SUBCATEGORY_IDS };
