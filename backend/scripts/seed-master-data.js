#!/usr/bin/env node
/** CLI: seed platform master reference data (idempotent). */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const { PrismaClient } = require("@prisma/client");
const { seedMasterReferenceData } = require("../src/scripts/seed-master-data-lib");

const prisma = new PrismaClient();

async function main() {
  const before = await prisma.masterReference.count();
  const result = await seedMasterReferenceData(prisma);
  const after = await prisma.masterReference.count();
  console.log("Master data seed complete.");
  console.log("Counts by category:", result.counts);
  console.log(`Total rows: ${before} → ${after}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
