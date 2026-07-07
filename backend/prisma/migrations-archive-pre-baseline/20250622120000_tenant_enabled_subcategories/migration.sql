-- Tenant granular service subcategories (Bangladesh travel agency catalog)
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "enabledSubcategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
