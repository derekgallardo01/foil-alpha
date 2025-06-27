// prisma/seed-simple.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting simplified database seed...');

    // 1. Create Users
    console.log('👥 Creating users...');

    const hashedAdminPassword = await bcrypt.hash('admin123', 10);
    const hashedUserPassword = await bcrypt.hash('user123', 10);

    // Create admin user
    const admin = await prisma.user.upsert({
        where: { email: 'admin@test.com' },
        update: {},
        create: {
            email: 'admin@test.com',
            name: 'Admin User',
            password: hashedAdminPassword,
            role: 'admin',
            is_verified: 1,
            registeredAt: new Date(),
        },
    });

    // Create regular users
    const bob = await prisma.user.upsert({
        where: { email: 'bob@test.com' },
        update: {},
        create: {
            email: 'bob@test.com',
            name: 'Bob Smith',
            password: hashedUserPassword,
            role: 'user',
            is_verified: 1,
            registeredAt: new Date(),
        },
    });

    const john = await prisma.user.upsert({
        where: { email: 'john@test.com' },
        update: {},
        create: {
            email: 'john@test.com',
            name: 'John Doe',
            password: hashedUserPassword,
            role: 'user',
            is_verified: 1,
            registeredAt: new Date(),
        },
    });

    console.log(`✅ Created users: ${admin.name}, ${bob.name}, ${john.name}`);
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
