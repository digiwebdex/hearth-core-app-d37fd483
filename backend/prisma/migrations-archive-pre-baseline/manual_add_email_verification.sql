-- Run this once after pulling: `psql $DATABASE_URL -f backend/prisma/migrations/manual_add_email_verification.sql`
-- Or simply: `cd backend && npx prisma migrate dev --name add_email_verification`

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifyToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifyExpiry" TIMESTAMP(3);
