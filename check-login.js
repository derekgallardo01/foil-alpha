// check-login-users.js - See which users can actually login
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLoginUsers() {
    console.log('🔐 Checking users with login credentials...\n');

    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                password: true,
                is_verified: true
            }
        });

        console.log('👥 All Users:');
        users.forEach(user => {
            const hasPassword = user.password && !['google-user', 'discord-user'].includes(user.password);
            const canLogin = hasPassword && user.is_verified;
            const status = canLogin ? '✅ CAN LOGIN' : '❌ CANNOT LOGIN';
            const reason = !hasPassword ? '(no password)' : !user.is_verified ? '(not verified)' : '';

            console.log(`  ${status} - ${user.name} (${user.email}) [${user.role}] ${reason}`);
        });

        console.log('\n💡 Dev Users Should Be:');
        console.log('  - admin@test.com / admin123 (admin)');
        console.log('  - user1@test.com / user123 (user)');
        console.log('  - user2@test.com / user123 (user)');

        console.log('\n🔧 If dev users are missing, run: node seed-dev-users.js');

    } catch (error) {
        console.error('❌ Error checking users:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkLoginUsers();