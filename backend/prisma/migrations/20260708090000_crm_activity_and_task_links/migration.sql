-- CRM module completion: unified Notes+Activities store, plus optional Task->record linkage.

-- AlterTable: Task gains optional CRM linkage + audit columns (all additive, backfilled).
ALTER TABLE "Task" ADD COLUMN "relatedType" TEXT;
ALTER TABLE "Task" ADD COLUMN "relatedId" TEXT;
ALTER TABLE "Task" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "Task" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Task_tenantId_status_idx" ON "Task"("tenantId", "status");
CREATE INDEX "Task_tenantId_relatedType_relatedId_idx" ON "Task"("tenantId", "relatedType", "relatedId");

-- CreateTable: entity-agnostic CRM interaction timeline (notes + activities).
CREATE TABLE "CrmActivity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'note',
    "title" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "outcome" TEXT,
    "dueAt" TIMESTAMP(3),
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CrmActivity_tenantId_entityType_entityId_createdAt_idx" ON "CrmActivity"("tenantId", "entityType", "entityId", "createdAt");
CREATE INDEX "CrmActivity_tenantId_type_idx" ON "CrmActivity"("tenantId", "type");
CREATE INDEX "CrmActivity_tenantId_dueAt_idx" ON "CrmActivity"("tenantId", "dueAt");
