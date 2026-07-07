-- Website is a Pro plan feature. The lean-default rollout hid it for Pro
-- tenants; restore it (switched on) for existing Pro agencies so nobody
-- loses the website builder they already pay for. New Pro signups still
-- start lean and can toggle it on in Settings.
UPDATE "Tenant"
SET "enabledModules" = array_append("enabledModules", 'website')
WHERE lower("subscriptionPlan") = 'pro'
  AND NOT ('website' = ANY("enabledModules"));
