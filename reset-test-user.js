// reset-test-user.js
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetTestUser() {
    try {
        const hashedPassword = await bcrypt.hash('user12345', 10);

        await prisma.user.update({
            where: { email: 'user@test.com' },
            data: {
                password: hashedPassword,
                is_verified: 1
            }
        });

        console.log('✅ Test user updated!');
        console.log('📧 Email: user@test.com');
        console.log('🔑 Password: user12345');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

resetTestUser();