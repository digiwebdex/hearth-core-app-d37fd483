-- Advanced (opt-in) sidebar modules per tenant. Lean core stays visible for all
-- plans; these bundles are activatable only by Business and Ultimate (enterprise).
ALTER TABLE "Tenant"
  ADD COLUMN "enabledModules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Grandfather existing Business / Ultimate tenants: keep full access so no live
-- top-tier agency loses menu items after deploy. Basic/Pro/Free reset to lean.
UPDATE "Tenant"
SET "enabledModules" = ARRAY[
  'subAgents','corporate','ticketing','tourGroups','visa','hajj',
  'studentManpower','documentsDesk','hrPayroll','marketing','website'
]::TEXT[]
WHERE lower("subscriptionPlan") IN ('business','enterprise','unlimited');
