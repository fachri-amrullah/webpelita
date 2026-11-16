declare const process: {
  env: Record<string, string | undefined>;
  exitCode?: number;
};

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();
async function main() {
  const name = process.env.SEED_ADMIN_NAME?.trim();
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const isProduction = process.env.NODE_ENV === 'production';
  const isPlaceholderEmail = email === 'replace-with-a-real-admin-email@example.com';
  if (!name || !email || !password || password.length < 12 || isPlaceholderEmail ||
    (isProduction && email.endsWith('.example.com')) || password.startsWith('REPLACE_WITH_')) {
    throw new Error('Set a real SEED_ADMIN_NAME and SEED_ADMIN_EMAIL plus a unique password of at least 12 characters.');
  }
  const configuredRole = process.env.SEED_ADMIN_ROLE?.trim() ?? 'ADMIN';
  if (configuredRole !== 'ADMIN' && configuredRole !== 'KADER') {
    throw new Error('SEED_ADMIN_ROLE must be ADMIN or KADER.');
  }
  const accountRole = configuredRole === 'KADER' ? Role.KADER : Role.ADMIN;
  const kaderName = process.env.SEED_KADER_NAME?.trim();
  const kaderEmail = process.env.SEED_KADER_EMAIL?.trim().toLowerCase();
  const kaderPassword = process.env.SEED_KADER_PASSWORD;
  const kaderConfigProvided = Boolean(kaderName || kaderEmail || kaderPassword);
  let seededKaderName: string | undefined;
  let seededKaderEmail: string | undefined;
  let seededKaderPassword: string | undefined;

  if (kaderConfigProvided) {
    const isPlaceholderKaderEmail = kaderEmail === 'replace-with-a-real-kader-email@example.com';
    if (!kaderName || !kaderEmail || !kaderPassword || kaderPassword.length < 12 || isPlaceholderKaderEmail ||
      (isProduction && kaderEmail.endsWith('.example.com')) || kaderPassword.startsWith('REPLACE_WITH_')) {
      throw new Error('Set real SEED_KADER_NAME and SEED_KADER_EMAIL values plus a unique password of at least 12 characters.');
    }
    seededKaderName = kaderName;
    seededKaderEmail = kaderEmail;
    seededKaderPassword = kaderPassword;
    if (seededKaderEmail === email && seededKaderPassword !== password) {
      throw new Error('When one email is configured for both roles, SEED_ADMIN_PASSWORD and SEED_KADER_PASSWORD must match.');
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const adminUser = await prisma.user.upsert({
    where: { email },
    create: { name, email, passwordHash, role: accountRole },
    update: { name, passwordHash, role: accountRole },
  });
  await prisma.userRoleGrant.upsert({
    where: { userId_role: { userId: adminUser.id, role: accountRole } },
    create: { userId: adminUser.id, role: accountRole },
    update: {},
  });
  console.info(`Seeded ${accountRole} account for ${email}`);

  if (seededKaderName && seededKaderEmail && seededKaderPassword) {
    const kaderUser = seededKaderEmail === email
      ? adminUser
      : await prisma.user.upsert({
        where: { email: seededKaderEmail },
        create: { name: seededKaderName, email: seededKaderEmail, passwordHash: await bcrypt.hash(seededKaderPassword, 12), role: Role.KADER },
        update: { name: seededKaderName, passwordHash: await bcrypt.hash(seededKaderPassword, 12), role: Role.KADER },
      });
    await prisma.userRoleGrant.upsert({
      where: { userId_role: { userId: kaderUser.id, role: Role.KADER } },
      create: { userId: kaderUser.id, role: Role.KADER },
      update: {},
    });
    console.info(`Seeded Kader account for ${seededKaderEmail}`);
  }
}
main().catch((error: unknown) => { console.error('Database seed failed:', error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
