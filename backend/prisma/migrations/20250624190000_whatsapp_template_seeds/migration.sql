-- Platform WhatsApp template defaults (idempotent — skip if type already seeded)
INSERT INTO "WhatsAppTemplate" ("id", "tenantId", "name", "type", "message", "metaTemplateName", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, 'Subscription renewal', 'subscriptionRenewal',
  'Dear {{ownerName}}, your {{plan}} plan has expired. Renew at app.travelagencyweb.com/subscription — Travel Agency Web',
  NULL, ARRAY['ownerName', 'plan', 'expiryDate']::TEXT[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "WhatsAppTemplate" WHERE "tenantId" IS NULL AND "type" = 'subscriptionRenewal');

INSERT INTO "WhatsAppTemplate" ("id", "tenantId", "name", "type", "message", "metaTemplateName", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, 'Subscription expiring soon', 'subscriptionExpiring',
  'Your {{plan}} plan expires on {{expiryDate}}. Renew now to avoid interruption. — Travel Agency Web',
  NULL, ARRAY['plan', 'expiryDate']::TEXT[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "WhatsAppTemplate" WHERE "tenantId" IS NULL AND "type" = 'subscriptionExpiring');

INSERT INTO "WhatsAppTemplate" ("id", "tenantId", "name", "type", "message", "metaTemplateName", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, 'Payment reminder', 'paymentReminder',
  'Reminder: Invoice {{invoiceNumber}} for ৳{{dueAmount}} is due on {{dueDate}}. — {{company}}',
  NULL, ARRAY['invoiceNumber', 'dueAmount', 'dueDate', 'company']::TEXT[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "WhatsAppTemplate" WHERE "tenantId" IS NULL AND "type" = 'paymentReminder');

INSERT INTO "WhatsAppTemplate" ("id", "tenantId", "name", "type", "message", "metaTemplateName", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, 'Trial last day', 'trialDripLast',
  'Last day! Your {{trialDays}}-day trial ends {{expiryDate}}. Renew: app.travelagencyweb.com/subscription',
  NULL, ARRAY['trialDays', 'expiryDate']::TEXT[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "WhatsAppTemplate" WHERE "tenantId" IS NULL AND "type" = 'trialDripLast');

INSERT INTO "WhatsAppTemplate" ("id", "tenantId", "name", "type", "message", "metaTemplateName", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, 'Passport expiry alert', 'passportExpiryAlert',
  'Dear {{clientName}}, your passport{{passportNumber}} expires on {{expiryDate}} ({{daysLeft}} days left). Please renew soon. — {{companyName}}',
  NULL, ARRAY['clientName', 'passportNumber', 'expiryDate', 'daysLeft', 'companyName']::TEXT[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "WhatsAppTemplate" WHERE "tenantId" IS NULL AND "type" = 'passportExpiryAlert');

INSERT INTO "WhatsAppTemplate" ("id", "tenantId", "name", "type", "message", "metaTemplateName", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, 'Passport expiry alert (BN)', 'passportExpiryAlertBn',
  'প্রিয় {{clientName}}, আপনার পাসপোর্ট{{passportNumber}} এর মেয়াদ {{expiryDate}} এ শেষ ({{daysLeft}} দিন বাকি)। দয়া করে নবায়ন করুন। — {{companyName}}',
  NULL, ARRAY['clientName', 'passportNumber', 'expiryDate', 'daysLeft', 'companyName']::TEXT[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "WhatsAppTemplate" WHERE "tenantId" IS NULL AND "type" = 'passportExpiryAlertBn');

INSERT INTO "WhatsAppTemplate" ("id", "tenantId", "name", "type", "message", "metaTemplateName", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, 'Travel departure reminder', 'travelDepartureReminder',
  'Dear {{clientName}}, your trip{{destination}} departs {{travelDate}} ({{daysLeft}} day(s)). Safe travels! — {{companyName}}',
  NULL, ARRAY['clientName', 'destination', 'travelDate', 'daysLeft', 'companyName']::TEXT[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "WhatsAppTemplate" WHERE "tenantId" IS NULL AND "type" = 'travelDepartureReminder');

INSERT INTO "WhatsAppTemplate" ("id", "tenantId", "name", "type", "message", "metaTemplateName", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, 'Travel departure reminder (BN)', 'travelDepartureReminderBn',
  'প্রিয় {{clientName}}, আপনার ভ্রমণ{{destination}} {{travelDate}} এ শুরু ({{daysLeft}} দিন বাকি)। শুভ যাত্রা! — {{companyName}}',
  NULL, ARRAY['clientName', 'destination', 'travelDate', 'daysLeft', 'companyName']::TEXT[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "WhatsAppTemplate" WHERE "tenantId" IS NULL AND "type" = 'travelDepartureReminderBn');
