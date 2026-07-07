-- Website blog posts + corporate client fields
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "companyName" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "clientType" TEXT NOT NULL DEFAULT 'individual';

CREATE TABLE IF NOT EXISTS "WebsitePost" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "coverImage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "authorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WebsitePost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WebsitePost_tenantId_slug_key" ON "WebsitePost"("tenantId", "slug");
CREATE INDEX IF NOT EXISTS "WebsitePost_tenantId_status_idx" ON "WebsitePost"("tenantId", "status");

DO $$ BEGIN
  ALTER TABLE "WebsitePost" ADD CONSTRAINT "WebsitePost_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
