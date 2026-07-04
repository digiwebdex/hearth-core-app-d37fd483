-- CRM Phase 6: CRM settings (configurable lists, custom fields, automations).
ALTER TABLE "Client" ADD COLUMN "customFields" JSONB;

CREATE TABLE "CrmConfig" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "leadSources" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "followUpTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "complaintCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "customFields" JSONB NOT NULL DEFAULT '[]',
  "automations" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CrmConfig_tenantId_key" ON "CrmConfig"("tenantId");
ALTER TABLE "CrmConfig" ADD CONSTRAINT "CrmConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
