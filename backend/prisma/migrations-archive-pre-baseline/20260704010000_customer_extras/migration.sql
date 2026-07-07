-- CRM Phase 5: customer wallet, family members, corporate credit/contract.
ALTER TABLE "Client" ADD COLUMN "walletBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Client" ADD COLUMN "creditLimit" DOUBLE PRECISION;
ALTER TABLE "Client" ADD COLUMN "contractRef" TEXT;
ALTER TABLE "Client" ADD COLUMN "contractExpiry" TEXT;

CREATE TABLE "ClientFamilyMember" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "relation" TEXT NOT NULL DEFAULT 'family',
  "passportNumber" TEXT,
  "dateOfBirth" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientFamilyMember_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ClientFamilyMember_clientId_idx" ON "ClientFamilyMember"("clientId");
ALTER TABLE "ClientFamilyMember" ADD CONSTRAINT "ClientFamilyMember_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WalletTransaction" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'credit',
  "amount" DOUBLE PRECISION NOT NULL,
  "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WalletTransaction_clientId_idx" ON "WalletTransaction"("clientId");
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
