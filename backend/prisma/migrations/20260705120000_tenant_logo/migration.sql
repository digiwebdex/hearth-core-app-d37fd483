-- Add agency logo (stored as a data URI or URL) to Tenant
ALTER TABLE "Tenant" ADD COLUMN "logo" TEXT;
