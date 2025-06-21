// scripts/create-test-data.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestData() {
    try {
        console.log('🔄 Creating test data...');

        // Create admin user
        const adminPassword = await bcrypt.hash('admin123', 10);
        const admin = await prisma.user.create({
            data: {
                name: 'Admin User',
                email: 'admin@tcgmarket.com',
                password: adminPassword,
                role: 'admin',
                subscriptionStatus: 'active',
                is_verified: 1
            }
        });
        console.log('✅ Admin user created:', admin.email);

        // Create test users
        const testUsers = [
            { name: 'John Doe', email: 'john@test.com', role: 'user' },
            { name: 'Jane Smith', email: 'jane@test.com', role: 'user' },
            { name: 'Bob Wilson', email: 'bob@test.com', role: 'user' }
        ];

        const userPassword = await bcrypt.hash('user123', 10);

        for (const userData of testUsers) {
            const user = await prisma.user.create({
                data: {
                    ...userData,
                    password: userPassword,
                    subscriptionStatus: 'active',
                    is_verified: 1
                }
            });
            console.log('✅ Test user created:', user.email);
        }

        // Create wallets for all users
        const allUsers = await prisma.user.findMany();

        for (const user of allUsers) {
            await prisma.userWallet.create({
                data: {
                    user_id: user.id,
                    balance: user.role === 'admin' ? 1000.00 : 100.00, // Give admin more money
                    frozen_balance: 0.00
                }
            });

            // Create initial wallet transaction
            await prisma.walletTransaction.create({
                data: {
                    user_id: user.id,
                    transaction_type: 'INITIAL_SETUP',
                    amount: user.role === 'admin' ? 1000.00 : 100.00,
                    balance_before: 0.00,
                    balance_after: user.role === 'admin' ? 1000.00 : 100.00,
                    description: 'Initial wallet setup with starting balance',
                    reference_type: 'SYSTEM_SETUP'
                }
            });
            console.log(`💰 Wallet created for ${user.name} with $${user.role === 'admin' ? '1000' : '100'}`);
        }

        // Create some sample cards
        const sampleCards = [
            {
                name: 'Pikachu',
                set_name: 'Base Set',
                set_number: '25',
                rarity: 'Common',
                card_type: 'Pokemon',
                hp: 60,
                image_url: 'https://images.pokemontcg.io/base1/25_hires.png'
            },
            {
                name: 'Charizard',
                set_name: 'Base Set',
                set_number: '4',
                rarity: 'Rare Holo',
                card_type: 'Pokemon',
                hp: 120,
                image_url: 'https://images.pokemontcg.io/base1/4_hires.png'
            },
            {
                name: 'Blastoise',
                set_name: 'Base Set',
                set_number: '2',
                rarity: 'Rare Holo',
                card_type: 'Pokemon',
                hp: 100,
                image_url: 'https://images.pokemontcg.io/base1/2_hires.png'
            }
        ];

        for (const cardData of sampleCards) {
            const card = await prisma.card.create({
                data: cardData
            });

            // Create user cards (admin owns some cards for sale)
            await prisma.userCard.create({
                data: {
                    card_id: card.id,
                    owner_id: admin.id,
                    condition: 'NM',
                    is_for_sale: true,
                    sale_type: 'FIXED',
                    fixed_price: Math.floor(Math.random() * 100) + 10 // Random price 10-110
                }
            });
            console.log(`🎴 Card created: ${card.name} (owned by admin, for sale)`);
        }

        console.log('🎉 Test data creation completed!');
        console.log('📧 Admin login: admin@tcgmarket.com / admin123');
        console.log('📧 User login: john@test.com / user123');

    } catch (error) {
        console.error('❌ Error creating test data:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the script
createTestData()
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });