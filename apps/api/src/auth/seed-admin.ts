import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@epsu/database';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const username = process.env.ADMIN_USERNAME;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }

  if (!username || !email || !password) {
    throw new Error(
      'ADMIN_USERNAME, ADMIN_EMAIL, and ADMIN_PASSWORD must be configured',
    );
  }

  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters long');
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const role = await prisma.role.upsert({
      where: { name: 'ADMINISTRATOR' },
      update: {},
      create: {
        name: 'ADMINISTRATOR',
        description: 'System administrator',
      },
    });

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
    });

    if (existingUser) {
      console.log('Administrator account already exists.');
      return;
    }

    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        firstName: 'System',
        middleName: null,
        lastName: 'Administrator',
        phone: null,
        status: 'ACTIVE',
      },
    });

    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
      },
    });

    console.log('Administrator account created successfully.');
    console.log(`Username: ${username}`);
    console.log(`Email: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Failed to create administrator:', error);
  process.exit(1);
});
