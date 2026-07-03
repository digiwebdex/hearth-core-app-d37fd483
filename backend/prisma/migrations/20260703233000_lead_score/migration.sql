-- Lead scoring for CRM Phase 1.
ALTER TABLE "Lead" ADD COLUMN "score" INTEGER NOT NULL DEFAULT 0;
