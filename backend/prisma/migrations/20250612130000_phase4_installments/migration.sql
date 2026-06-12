-- Phase 4: invoice installment schedules
CREATE TABLE IF NOT EXISTS "InvoiceInstallment" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "dueDate" TEXT,
  "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "tenantId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvoiceInstallment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InvoiceInstallment"
  ADD CONSTRAINT "InvoiceInstallment_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvoiceInstallment"
  ADD CONSTRAINT "InvoiceInstallment_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "InvoiceInstallment_invoiceId_idx" ON "InvoiceInstallment"("invoiceId");
CREATE INDEX IF NOT EXISTS "InvoiceInstallment_tenantId_dueDate_idx" ON "InvoiceInstallment"("tenantId", "dueDate");
