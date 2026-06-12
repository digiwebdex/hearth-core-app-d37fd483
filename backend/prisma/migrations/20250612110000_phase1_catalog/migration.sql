-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "enabledServiceTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "TravelPackage" ADD COLUMN IF NOT EXISTS "visaRequired" BOOLEAN;
ALTER TABLE "TravelPackage" ADD COLUMN IF NOT EXISTS "cancellationPolicy" TEXT;
ALTER TABLE "TravelPackage" ADD COLUMN IF NOT EXISTS "seasonalPricing" JSONB;
