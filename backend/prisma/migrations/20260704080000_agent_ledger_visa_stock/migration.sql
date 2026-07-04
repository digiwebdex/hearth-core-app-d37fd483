-- Agent ledger (deposit/balance/payment) + Visa stock inventory.
ALTER TABLE "Agent" ADD COLUMN "address" TEXT;
ALTER TABLE "Agent" ADD COLUMN "balance" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE "AgentTransaction" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'deposit',
  "amount" DOUBLE PRECISION NOT NULL,
  "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "method" TEXT,
  "note" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentTransaction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AgentTransaction_agentId_idx" ON "AgentTransaction"("agentId");
ALTER TABLE "AgentTransaction" ADD CONSTRAINT "AgentTransaction_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentTransaction" ADD CONSTRAINT "AgentTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "VisaStock" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "visaType" TEXT NOT NULL,
  "country" TEXT,
  "duration" TEXT,
  "sponsorId" TEXT,
  "visaId" TEXT,
  "occupation" TEXT,
  "buyingPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "sellingPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'available',
  "buyerName" TEXT,
  "agentId" TEXT,
  "notes" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VisaStock_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VisaStock_tenantId_status_idx" ON "VisaStock"("tenantId", "status");
ALTER TABLE "VisaStock" ADD CONSTRAINT "VisaStock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
