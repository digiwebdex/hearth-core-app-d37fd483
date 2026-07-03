-- Website builder is Business / Ultimate only. Remove the 'website' module
-- from any tenant whose plan is below Business (undoes the earlier Pro
-- grandfather). Business/Ultimate tenants keep it.
UPDATE "Tenant"
SET "enabledModules" = array_remove("enabledModules", 'website')
WHERE lower("subscriptionPlan") NOT IN ('business', 'enterprise', 'unlimited')
  AND 'website' = ANY("enabledModules");
