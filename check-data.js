// check-data.js - See what data you currently have
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkData() {
    console.log('🔍 Checking current database data...\n');

    try {
        // Check users
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                role: true
            }
        });
        console.log(`👥 Users (${users.length}):`);
        users.forEach(user => {
            console.log(`  - ${user.name} (${user.email}) [${user.role}]`);
        });

        // Check cards
        const cards = await prisma.card.findMany({
            select: {
                id: true,
                name: true,
                set_name: true,
                set_number: true
            }
        });
        console.log(`\n🃏 Cards (${cards.length}):`);
        cards.forEach(card => {
            console.log(`  - ${card.name} (${card.set_name} #${card.set_number})`);
        });

        // Check user cards (who owns what) - Fixed version
        const userCards = await prisma.userCard.findMany({
            select: {
                id: true,
                condition: true,
                is_for_sale: true,
                sale_type: true,
                fixed_price: true,
                card_id: true,
                owner_id: true
            }
        });

        console.log(`\n🎴 User Cards/Ownership (${userCards.length}):`);

        // Get detailed info for each user card
        for (const uc of userCards) {
            try {
                const card = await prisma.card.findUnique({
                    where: { id: uc.card_id },
                    select: { name: true }
                });

                const owner = await prisma.user.findUnique({
                    where: { id: uc.owner_id },
                    select: { name: true }
                });

                const status = uc.is_for_sale ? `FOR SALE (${uc.sale_type})` : 'OWNED';
                const price = uc.fixed_price ? ` - ${Number(uc.fixed_price)}` : '';

                console.log(`  - ${owner?.name || 'Unknown'} owns ${card?.name || 'Unknown'} [${status}${price}]`);
            } catch (error) {
                console.log(`  - Error loading user card ${uc.id}`);
            }
        }

        // Check wallets - Fixed version
        const wallets = await prisma.userWallet.findMany({
            select: {
                user_id: true,
                balance: true,
                frozen_balance: true
            }
        });

        console.log(`\n💰 Wallets (${wallets.length}):`);

        // Get user names for each wallet
        for (const wallet of wallets) {
            try {
                const user = await prisma.user.findUnique({
                    where: { id: wallet.user_id },
                    select: { name: true }
                });

                console.log(`  - ${user?.name || 'Unknown'}: ${Number(wallet.balance).toFixed(2)} (frozen: ${Number(wallet.frozen_balance).toFixed(2)})`);
            } catch (error) {
                console.log(`  - Error loading wallet for user ${wallet.user_id}`);
            }
        }

        console.log('\n✨ Database check complete!');

    } catch (error) {
        console.error('❌ Database check error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkData();