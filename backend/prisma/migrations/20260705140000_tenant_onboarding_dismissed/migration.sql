-- Persist per-tenant onboarding checklist dismissal
ALTER TABLE "Tenant" ADD COLUMN "onboardingDismissedAt" TIMESTAMP(3);
