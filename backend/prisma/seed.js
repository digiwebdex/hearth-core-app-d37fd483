const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

const isProduction = process.env.NODE_ENV === "production";
const allowPasswordReset = process.env.ALLOW_SEED_PASSWORD_RESET === "true";

function seedCredential(envName, devFallback) {
  const value = process.env[envName];
  if (value) return value;
  if (isProduction) {
    throw new Error(`${envName} is required when seeding in production`);
  }
  console.warn(`[seed] ${envName} not set — using development-only default`);
  return devFallback;
}

const adminEmail = process.env.SEED_ADMIN_EMAIL || "digiwebdex@gmail.com";
const adminPassword = seedCredential("SEED_ADMIN_PASSWORD", "DevAdmin123!local");
const demoEmail = process.env.SEED_DEMO_EMAIL || "user@demo.com";
const demoPassword = seedCredential("SEED_DEMO_PASSWORD", "demo123");

async function upsertUser({ email, name, role, tenantId, password }) {
  const passwordData = {};
  if (!isProduction || allowPasswordReset) {
    passwordData.password = await bcrypt.hash(password, 10);
    passwordData.resetToken = null;
    passwordData.resetTokenExpiry = null;
  }

  return prisma.user.upsert({
    where: { email },
    update: {
      name,
      role,
      status: "active",
      tenantId,
      ...passwordData,
    },
    create: {
      name,
      email,
      password: passwordData.password || await bcrypt.hash(password, 10),
      role,
      status: "active",
      tenantId,
    },
  });
}

async function main() {
  console.log("🌱 Seeding database...");

  let adminTenant = await prisma.tenant.findFirst({ where: { name: "TAWSS Platform" } });
  if (!adminTenant) {
    adminTenant = await prisma.tenant.create({
      data: { name: "TAWSS Platform", subscriptionPlan: "enterprise", subscriptionStatus: "active" },
    });
  }

  await prisma.user.deleteMany({ where: { email: "admin@travelagencyweb.com" } });

  const adminUser = await upsertUser({
    email: adminEmail,
    name: "Super Admin",
    role: "super_admin",
    tenantId: adminTenant.id,
    password: adminPassword,
  });
  await prisma.tenant.update({ where: { id: adminTenant.id }, data: { ownerId: adminUser.id } });

  let demoTenant = await prisma.tenant.findFirst({ where: { name: "Al-Safa Travel Agency" } });
  if (!demoTenant) {
    demoTenant = await prisma.tenant.create({
      data: {
        name: "Al-Safa Travel Agency",
        subscriptionPlan: "pro",
        subscriptionStatus: "active",
        subscriptionExpiry: new Date("2027-01-01"),
      },
    });
  }

  const demoUser = await upsertUser({
    email: demoEmail,
    name: "Demo User",
    role: "tenant_owner",
    tenantId: demoTenant.id,
    password: demoPassword,
  });
  await prisma.tenant.update({ where: { id: demoTenant.id }, data: { ownerId: demoUser.id } });

  const existingClient = await prisma.client.findFirst({ where: { email: "ahmed@example.com", tenantId: demoTenant.id } });
  if (!existingClient) {
    await prisma.client.create({
      data: {
        name: "Ahmed Rahman",
        phone: "+880171234567",
        email: "ahmed@example.com",
        nationality: "Bangladeshi",
        tenantId: demoTenant.id,
      },
    });
    await prisma.client.create({
      data: {
        name: "Fatima Begum",
        phone: "+880181234567",
        email: "fatima@example.com",
        nationality: "Bangladeshi",
        tenantId: demoTenant.id,
      },
    });

    const agent = await prisma.agent.create({
      data: {
        name: "Karim Hassan",
        phone: "+880191234567",
        email: "karim@alsafa.com",
        tenantId: demoTenant.id,
        commissionProfile: {
          create: {
            commissionRate: 5,
            status: "active",
          },
        },
      },
    });

    await prisma.vendor.create({
      data: {
        name: "Royal Wings Airlines",
        phone: "+966501234567",
        email: "bookings@royalwings.sa",
        category: "airline",
        status: "active",
        tenantId: demoTenant.id,
      },
    });
    await prisma.vendor.create({
      data: {
        name: "Makkah Grand Hotel",
        phone: "+966521234567",
        email: "reservations@makkahgrand.sa",
        category: "hotel",
        status: "active",
        tenantId: demoTenant.id,
      },
    });

    await prisma.lead.create({
      data: {
        name: "Saiful Islam",
        phone: "+880161234567",
        email: "saiful@example.com",
        status: "qualified",
        source: "website",
        destination: "Makkah, Saudi Arabia",
        travelerCount: 4,
        budget: 250000,
        tenantId: demoTenant.id,
      },
    });

    const client1 = await prisma.client.findFirst({ where: { email: "ahmed@example.com", tenantId: demoTenant.id } });
    const booking = await prisma.booking.create({
      data: {
        type: "package",
        title: "Umrah Package - March 2026",
        clientId: client1.id,
        agentId: agent.id,
        destination: "Makkah & Madinah",
        travelDateFrom: "2026-03-15",
        travelDateTo: "2026-03-29",
        travelerCount: 2,
        amount: 180000,
        cost: 140000,
        profit: 40000,
        status: "confirmed",
        tenantId: demoTenant.id,
      },
    });

    await prisma.invoice.create({
      data: {
        invoiceNumber: "INV-00001",
        bookingId: booking.id,
        clientId: client1.id,
        totalAmount: 180000,
        paidAmount: 90000,
        dueAmount: 90000,
        status: "partial",
        issuedDate: "2026-01-15",
        dueDate: "2026-03-01",
        tenantId: demoTenant.id,
      },
    });
  }

  console.log("✅ Seeding complete!");
  console.log(`   Super Admin: ${adminEmail}`);
  console.log(`   Demo User:   ${demoEmail}`);
  if (isProduction && !allowPasswordReset) {
    console.log("   (Production: user passwords were not reset. Set ALLOW_SEED_PASSWORD_RESET=true to update.)");
  } else {
    console.log("   Set SEED_* env vars to customize seeded accounts.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
