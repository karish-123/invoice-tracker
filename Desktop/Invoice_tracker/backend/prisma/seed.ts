import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...\n');

  // ── Executives ─────────────────────────────────────────────────────────────
  const exec1 = await prisma.executive.upsert({
    where:  { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: { id: '00000000-0000-0000-0000-000000000001', name: 'John Smith' },
  });

  const exec2 = await prisma.executive.upsert({
    where:  { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: { id: '00000000-0000-0000-0000-000000000002', name: 'Jane Doe' },
  });

  console.log(`Executives: ${exec1.name}, ${exec2.name}`);

  // ── Routes ──────────────────────────────────────────────────────────────────
  const routes = await Promise.all(
    [
      { routeNumber: 'RT-001', description: 'North District Route' },
      { routeNumber: 'RT-002', description: 'South District Route' },
      { routeNumber: 'RT-003', description: 'East District Route' },
    ].map((r) =>
      prisma.route.upsert({
        where:  { routeNumber: r.routeNumber },
        update: {},
        create: r,
      })
    )
  );
  console.log(`Routes: ${routes.map((r) => r.routeNumber).join(', ')}`);

  // ── Users ───────────────────────────────────────────────────────────────────
  const ROUNDS = 12;

  const admin = await prisma.user.upsert({
    where:  { username: 'admin' },
    update: {},
    create: {
      name:         'System Administrator',
      username:     'admin',
      passwordHash: await bcrypt.hash('admin123!', ROUNDS),
      role:         Role.ADMIN,
    },
  });

  const staff = await prisma.user.upsert({
    where:  { username: 'office.staff' },
    update: {},
    create: {
      name:         'Office Staff Member',
      username:     'office.staff',
      passwordHash: await bcrypt.hash('staff123!', ROUNDS),
      role:         Role.OFFICE_STAFF,
    },
  });

  // Executive user account linked to exec1
  const execUser = await prisma.user.upsert({
    where:  { username: 'john.smith' },
    update: {},
    create: {
      name:         'John Smith',
      username:     'john.smith',
      passwordHash: await bcrypt.hash('exec123!', ROUNDS),
      role:         Role.EXECUTIVE,
      executiveId:  exec1.id,
    },
  });

  console.log(`Users: ${admin.username}, ${staff.username}, ${execUser.username}`);

  console.log('\n✔ Seeding complete!\n');
  console.log('Default credentials:');
  console.log('  Admin:        admin       / admin123!');
  console.log('  Office Staff: office.staff / staff123!');
  console.log('  Executive:    john.smith   / exec123!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
