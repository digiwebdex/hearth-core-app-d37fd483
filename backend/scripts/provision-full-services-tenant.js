#!/usr/bin/env node
/**
 * Enable all ERP service types for a tenant (full-service travel agency).
 * Usage: node scripts/provision-full-services-tenant.js [tenant-slug-or-name]
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");
const { ALL_SUBCATEGORY_IDS } = require("../src/constants/serviceCatalogIds");

const ALL_SERVICES = [
  "hajj_umrah",
  "tour_domestic",
  "tour_international",
  "visa",
  "air_ticket",
  "hotel",
  "transport",
  "cruise",
  "study_abroad",
  "medical_tourism",
  "corporate_travel",
  "mice_event",
  "b2b_agent",
  "custom",
];

const DEFAULT_TENANT_NAME = "True End Travels";
const DEFAULT_SLUG = "true-end-travels";
const DEFAULT_OWNER_EMAIL = process.env.TRUE_END_OWNER_EMAIL || "owner@trueendtravels.com";
const DEFAULT_OWNER_NAME = process.env.TRUE_END_OWNER_NAME || "True End Travels Owner";
const DEFAULT_OWNER_PASSWORD = process.env.TRUE_END_OWNER_PASSWORD;

const prisma = new PrismaClient();

async function findTenant(query) {
  if (!query) {
    return prisma.tenant.findFirst({
      where: {
        OR: [
          { slug: DEFAULT_SLUG },
          { name: { equals: DEFAULT_TENANT_NAME, mode: "insensitive" } },
        ],
      },
    });
  }
  return prisma.tenant.findFirst({
    where: {
      OR: [
        { slug: query },
        { name: { contains: query, mode: "insensitive" } },
      ],
    },
  });
}

async function main() {
  const query = process.argv[2] || DEFAULT_SLUG;
  let tenant = await findTenant(query);

  if (!tenant) {
    const password = DEFAULT_OWNER_PASSWORD || crypto.randomBytes(12).toString("base64url");
    const hashed = await bcrypt.hash(password, 10);
    const emailTaken = await prisma.user.findUnique({ where: { email: DEFAULT_OWNER_EMAIL } });
    if (emailTaken) {
      console.error(`Cannot create tenant: email ${DEFAULT_OWNER_EMAIL} already registered.`);
      process.exit(1);
    }

    tenant = await prisma.tenant.create({
      data: {
        name: DEFAULT_TENANT_NAME,
        slug: DEFAULT_SLUG,
        subscriptionPlan: "pro",
        subscriptionStatus: "active",
        subscriptionExpiry: new Date(Date.now() + 365 * 86400000),
        enabledServiceTypes: ALL_SERVICES,
        enabledSubcategories: [...ALL_SUBCATEGORY_IDS],
        enableHajjUmrahModule: true,
        enableBdOperationsModule: true,
      },
    });

    const owner = await prisma.user.create({
      data: {
        name: DEFAULT_OWNER_NAME,
        email: DEFAULT_OWNER_EMAIL,
        password: hashed,
        role: "tenant_owner",
        status: "active",
        approvedAt: new Date(),
        tenantId: tenant.id,
      },
    });
    await prisma.tenant.update({ where: { id: tenant.id }, data: { ownerId: owner.id } });

    console.log("Created tenant:", tenant.name, tenant.slug);
    console.log("Owner login:", DEFAULT_OWNER_EMAIL);
    if (!DEFAULT_OWNER_PASSWORD) {
      console.log("Temporary password (share securely):", password);
    }
  } else {
    tenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        enabledServiceTypes: ALL_SERVICES,
        enabledSubcategories: [...ALL_SUBCATEGORY_IDS],
        enableHajjUmrahModule: true,
        enableBdOperationsModule: true,
      },
    });
    console.log("Updated tenant:", tenant.name, tenant.slug);
  }

  console.log("Enabled services:", tenant.enabledServiceTypes.join(", "));
  console.log("Hajj module:", tenant.enableHajjUmrahModule);
  console.log("BD/Student module:", tenant.enableBdOperationsModule);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
