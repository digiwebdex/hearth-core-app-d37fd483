-- AlterTable: track onboarding completion per tenant
ALTER TABLE "Tenant" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);
