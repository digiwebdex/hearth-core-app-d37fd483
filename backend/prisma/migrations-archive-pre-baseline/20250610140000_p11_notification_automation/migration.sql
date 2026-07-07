-- CreateTable
CREATE TABLE "SmsSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnBooking" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnPayment" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnLead" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationAutomation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "sms" BOOLEAN NOT NULL DEFAULT true,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationAutomation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "recipient" TEXT NOT NULL,
    "recipientName" TEXT,
    "message" TEXT NOT NULL,
    "errorMessage" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "notificationId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SmsSettings_tenantId_key" ON "SmsSettings"("tenantId");

-- CreateIndex
CREATE INDEX "NotificationAutomation_tenantId_idx" ON "NotificationAutomation"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationAutomation_tenantId_eventType_key" ON "NotificationAutomation"("tenantId", "eventType");

-- CreateIndex
CREATE INDEX "NotificationDelivery_tenantId_createdAt_idx" ON "NotificationDelivery"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_tenantId_eventType_idx" ON "NotificationDelivery"("tenantId", "eventType");

-- CreateIndex
CREATE INDEX "NotificationDelivery_tenantId_status_idx" ON "NotificationDelivery"("tenantId", "status");

-- CreateIndex
CREATE INDEX "NotificationDelivery_tenantId_channel_idx" ON "NotificationDelivery"("tenantId", "channel");

-- AddForeignKey
ALTER TABLE "SmsSettings" ADD CONSTRAINT "SmsSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill SmsSettings for existing tenants
INSERT INTO "SmsSettings" ("id", "tenantId", "smsEnabled", "notifyOnBooking", "notifyOnPayment", "notifyOnLead", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, t."id", true, true, true, true, NOW(), NOW()
FROM "Tenant" t
WHERE NOT EXISTS (
  SELECT 1 FROM "SmsSettings" s WHERE s."tenantId" = t."id"
);

-- Backfill NotificationAutomation rows (3 events per tenant)
INSERT INTO "NotificationAutomation" ("id", "tenantId", "eventType", "sms", "inApp", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, t."id", e."eventType", true, true, NOW(), NOW()
FROM "Tenant" t
CROSS JOIN (VALUES ('lead_created'), ('booking_created'), ('payment_received')) AS e("eventType")
WHERE NOT EXISTS (
  SELECT 1 FROM "NotificationAutomation" a
  WHERE a."tenantId" = t."id" AND a."eventType" = e."eventType"
);
