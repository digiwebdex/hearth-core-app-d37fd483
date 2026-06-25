require('dotenv').config({ path: '/var/www/hearth-core-app/backend/.env' });

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

if (process.env.ALLOW_RESET_ADMIN !== "true") {
  console.error("Refusing to run: set ALLOW_RESET_ADMIN=true to enable this script.");
  process.exit(1);
}

const EMAIL = process.env.RESET_ADMIN_EMAIL || 'bditengineer@gmail.com';
const NEW_PASSWORD = process.env.RESET_ADMIN_PASSWORD || 'Admin@12345';

(async () => {
  const hash = await bcrypt.hash(NEW_PASSWORD, 10);

  let user = await prisma.user.findUnique({
    where: { email: EMAIL },
  });

  if (!user) {
    let tenant = await prisma.tenant.findFirst({
      where: { slug: 'platform-admin' },
    });

    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          name: 'Platform Admin',
          slug: 'platform-admin',
          subscriptionPlan: 'enterprise',
          subscriptionStatus: 'active',
        },
      });
    }

    user = await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: EMAIL,
        password: hash,
        role: 'super_admin',
        status: 'active',
        emailVerified: true,
        tenantId: tenant.id,
      },
    });

    console.log('✅ New admin created:', user.email);
  } else {
    user = await prisma.user.update({
      where: { email: EMAIL },
      data: {
        password: hash,
        role: 'super_admin',
        status: 'active',
        emailVerified: true,
      },
    });

    console.log('✅ Admin password reset:', user.email);
  }

  console.log('Role:', user.role);
  console.log('Status:', user.status);
  console.log('Login email:', EMAIL);
  console.log('Login password:', NEW_PASSWORD);

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('❌ Error:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
