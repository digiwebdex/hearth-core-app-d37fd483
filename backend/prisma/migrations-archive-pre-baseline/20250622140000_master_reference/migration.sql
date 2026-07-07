-- Platform master reference data (countries, cities, airlines, airports, etc.)
CREATE TABLE IF NOT EXISTS "MasterReference" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "parentId" TEXT,
    "meta" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterReference_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MasterReference_category_isActive_idx" ON "MasterReference"("category", "isActive");
CREATE INDEX IF NOT EXISTS "MasterReference_parentId_idx" ON "MasterReference"("parentId");
CREATE INDEX IF NOT EXISTS "MasterReference_category_name_idx" ON "MasterReference"("category", "name");

DO $$ BEGIN
  ALTER TABLE "MasterReference" ADD CONSTRAINT "MasterReference_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "MasterReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
