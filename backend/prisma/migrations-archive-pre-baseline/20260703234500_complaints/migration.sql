-- CRM Phase 2: Complaints module.
CREATE TABLE "Complaint" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "clientId" TEXT,
  "clientName" TEXT,
  "bookingId" TEXT,
  "category" TEXT NOT NULL DEFAULT 'general',
  "priority" TEXT NOT NULL DEFAULT 'medium',
  "status" TEXT NOT NULL DEFAULT 'open',
  "assignedTo" TEXT,
  "resolution" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "feedback" TEXT,
  "rating" INTEGER,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Complaint_tenantId_status_idx" ON "Complaint"("tenantId", "status");
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
