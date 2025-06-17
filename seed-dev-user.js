// seed-dev-users.js - Run this to create development test users
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEV_USERS = [
    {
        id: 999,
        email: 'admin@test.com',
        name: 'Admin User',
        role: 'admin',
        password: 'admin12345', // 8+ characters
        wallet_balance: 10000.00
    },
    {
        id: 998,
        email: 'user1@test.com',
        name: 'Test User 1',
        role: 'user',
        password: 'user12345', // 8+ characters
        wallet_balance: 1000.00
    },
    {
        id: 997,
        email: 'user2@test.com',
        name: 'Test User 2',
        role: 'user',
        password: 'user12345', // 8+ characters
        wallet_balance: 1000.00
    },
    {
        id: 996,
        email: 'buyer@test.com',
        name: 'Buyer User',
        role: 'user',
        password: 'buyer12345', // 8+ characters
        wallet_balance: 2000.00
    },
    {
        id: 995,
        email: 'seller@test.com',
        name: 'Seller User',
        role: 'user',
        password: 'seller12345', // 8+ characters
        wallet_balance: 500.00
    }
];

async function seedDevUsers() {
    console.log('🌱 Seeding development users...');

    for (const devUser of DEV_USERS) {
        try {
            // Check if user exists by email (not ID to avoid conflicts)
            const existingUser = await prisma.user.findUnique({
                where: { email: devUser.email }
            });

            if (existingUser) {
                // Update existing user with proper password
                const hashedPassword = await bcrypt.hash(devUser.password, 10);

                await prisma.user.update({
                    where: { email: devUser.email },
                    data: {
                        password: hashedPassword,
                        is_verified: true,
                        role: devUser.role
                    }
                });

                console.log(`✅ Updated existing user: ${devUser.email} with new password`);
            } else {
                // Create new user
                const hashedPassword = await bcrypt.hash(devUser.password, 10);

                const user = await prisma.user.create({
                    data: {
                        email: devUser.email,
                        name: devUser.name,
                        password: hashedPassword,
                        role: devUser.role,
                        is_verified: true,
                        subscriptionStatus: 'active'
                    }
                });

                console.log(`✅ Created new user: ${devUser.email}`);
            }

            // Get the user to create/update wallet
            const user = await prisma.user.findUnique({
                where: { email: devUser.email }
            });

            if (user) {
                // Create or update wallet
                const existingWallet = await prisma.userWallet.findUnique({
                    where: { user_id: user.id }
                });

                if (existingWallet) {
                    await prisma.userWallet.update({
                        where: { user_id: user.id },
                        data: { balance: devUser.wallet_balance }
                    });
                } else {
                    await prisma.userWallet.create({
                        data: {
                            user_id: user.id,
                            balance: devUser.wallet_balance
                        }
                    });
                }

                console.log(`💰 Set wallet balance: ${devUser.wallet_balance}`);
            }

        } catch (error) {
            console.error(`❌ Error processing user ${devUser.email}:`, error);
        }
    }

    console.log('\n🎉 Development users seeded successfully!');
    console.log('\n📋 Login Credentials (8+ character passwords):');
    DEV_USERS.forEach(user => {
        console.log(`   ${user.email} / ${user.password} (${user.role})`);
    });
}

seedDevUsers()
    .catch(console.error)
    .finally(() => prisma.$disconnect());