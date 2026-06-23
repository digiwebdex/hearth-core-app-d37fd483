#!/usr/bin/env node
/**
 * Seed demo travel packages from starter templates for a tenant.
 * Usage: node scripts/seed-demo-packages.js [tenant-slug]
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const { PrismaClient } = require("@prisma/client");
const DEMO_TEMPLATES = require("../src/constants/demoPackageTemplates");

const DEFAULT_SLUG = "true-end-travels";

const prisma = new PrismaClient();

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function main() {
  const slug = process.argv[2] || DEFAULT_SLUG;
  const tenant = await prisma.tenant.findFirst({
    where: { OR: [{ slug }, { name: { contains: slug, mode: "insensitive" } }] },
  });

  if (!tenant) {
    console.error(`Tenant not found: ${slug}`);
    process.exit(1);
  }

  let created = 0;
  let updated = 0;

  for (const tpl of DEMO_TEMPLATES) {
    const existing = await prisma.travelPackage.findFirst({
      where: { tenantId: tenant.id, code: tpl.code },
    });

    const base = {
      tenantId: tenant.id,
      code: tpl.code,
      title: tpl.title,
      slug: slugify(tpl.title),
      serviceType: tpl.serviceType,
      summary: tpl.summary || "",
      destination: tpl.destination || "",
      country: tpl.country || "",
      durationDays: tpl.durationDays || 1,
      durationNights: tpl.durationNights || 0,
      basePrice: tpl.basePrice || 0,
      currency: "BDT",
      status: "published",
      isFeatured: false,
      visaRequired: !!tpl.visaRequired,
    };

    let packageId;
    if (existing) {
      await prisma.travelPackage.update({ where: { id: existing.id }, data: base });
      packageId = existing.id;
      await prisma.travelPackageDay.deleteMany({ where: { packageId } });
      await prisma.travelPackageInclusion.deleteMany({ where: { packageId } });
      await prisma.travelPackagePricing.deleteMany({ where: { packageId } });
      updated += 1;
    } else {
      const row = await prisma.travelPackage.create({ data: base });
      packageId = row.id;
      created += 1;
    }

    if (tpl.days?.length) {
      await prisma.travelPackageDay.createMany({
        data: tpl.days.map((d) => ({ ...d, packageId })),
      });
    }
    if (tpl.inclusions?.length) {
      await prisma.travelPackageInclusion.createMany({
        data: tpl.inclusions.map((inc) => ({ ...inc, packageId })),
      });
    }
    if (tpl.pricing?.length) {
      await prisma.travelPackagePricing.createMany({
        data: tpl.pricing.map((p) => ({ ...p, packageId })),
      });
    }

    console.log(`${existing ? "Updated" : "Created"}: ${tpl.code} — ${tpl.title}`);
  }

  console.log(`\nTenant: ${tenant.name} (${tenant.slug})`);
  console.log(`Packages: ${created} created, ${updated} updated`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
