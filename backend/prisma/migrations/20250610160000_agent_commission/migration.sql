-- Agent commission profile (1:1 extension — no ALTER on Agent columns)
CREATE TABLE "AgentCommissionProfile" (
    "agentId" TEXT NOT NULL,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "userId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentCommissionProfile_pkey" PRIMARY KEY ("agentId")
);

CREATE UNIQUE INDEX "AgentCommissionProfile_userId_key" ON "AgentCommissionProfile"("userId");

ALTER TABLE "AgentCommissionProfile" ADD CONSTRAINT "AgentCommissionProfile_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentCommissionProfile" ADD CONSTRAINT "AgentCommissionProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Booking commission snapshot (1:1 extension — no ALTER on Booking columns)
CREATE TABLE "BookingAgentCommission" (
    "bookingId" TEXT NOT NULL,
    "agentCommissionAmount" DOUBLE PRECISION,
    "agentCommissionStatus" TEXT DEFAULT 'pending',

    CONSTRAINT "BookingAgentCommission_pkey" PRIMARY KEY ("bookingId")
);

ALTER TABLE "BookingAgentCommission" ADD CONSTRAINT "BookingAgentCommission_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "BookingAgentCommission_status_idx" ON "BookingAgentCommission"("agentCommissionStatus");

-- Backfill profiles for existing agents
INSERT INTO "AgentCommissionProfile" ("agentId", "commissionRate", "status", "updatedAt")
SELECT "id", 0, 'active', "createdAt" FROM "Agent"
ON CONFLICT ("agentId") DO NOTHING;

-- Backfill pending commission for existing agent bookings
INSERT INTO "BookingAgentCommission" ("bookingId", "agentCommissionAmount", "agentCommissionStatus")
SELECT
    b."id",
    ROUND((b."amount" * (p."commissionRate" / 100.0))::numeric, 2)::double precision,
    'pending'
FROM "Booking" AS b
INNER JOIN "AgentCommissionProfile" AS p ON p."agentId" = b."agentId"
WHERE b."agentId" IS NOT NULL
  AND b."status" <> 'cancelled'
  AND p."commissionRate" > 0
ON CONFLICT ("bookingId") DO NOTHING;
