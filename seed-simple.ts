// seed-simple.ts
import { PrismaClient, User, Card } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting complete database seed...');

    // Create Admin User
    const hashedAdminPassword = await bcrypt.hash('admin123', 12);
    const admin = await prisma.user.upsert({
        where: { email: 'admin@gmail.com' },
        update: {},
        create: {
            email: 'admin@gmail.com',
            name: 'Admin User',
            password: hashedAdminPassword,
            role: 'admin',
            subscriptionStatus: 'active',
            is_verified: 1,
        }
    });
    console.log('✅ Created admin user:', admin.email);

    // Create Test Users
    const hashedUserPassword = await bcrypt.hash('user123', 12);

    const testUsers = [
        {
            email: 'john@test.com',
            name: 'John Collector',
        },
        {
            email: 'sarah@test.com',
            name: 'Sarah Trainer',
        },
        {
            email: 'mike@test.com',
            name: 'Mike Trader',
        }
    ];

    // Explicitly type the array
    const createdUsers: User[] = [];
    for (const userData of testUsers) {
        const user = await prisma.user.upsert({
            where: { email: userData.email },
            update: {},
            create: {
                email: userData.email,
                name: userData.name,
                password: hashedUserPassword,
                role: 'user',
                subscriptionStatus: 'active',
                is_verified: 1,
            }
        });
        createdUsers.push(user);
        console.log(`✅ Created test user: ${user.email}`);
    }

    // Create User Wallets
    for (const user of [admin, ...createdUsers]) {
        const wallet = await prisma.userWallet.upsert({
            where: { user_id: user.id },
            update: {},
            create: {
                user_id: user.id,
                balance: user.role === 'admin' ? 10000.00 : 500.00,
                frozen_balance: 0.00
            }
        });
        console.log(`💰 Created wallet for ${user.name}: $${wallet.balance}`);
    }

    // Create Sample Cards
    const sampleCards = [
        {
            price_tracker_id: 'base1-4',
            name: 'Charizard',
            number: '4',
            rarity: 'Rare Holo',
            set_id: 'base1',
            set_name: 'Base',
            set_series: 'Base',
            set_printed_total: 102,
            set_total: 102,
            set_release_date: '1999/01/09',
            set_ptcgo_code: 'BS',
            image_small: 'https://images.pokemontcg.io/base1/4.png',
            market_price: 461.52,
            price_source: 'tcgplayer',
            tcgplayer_data: {
                prices: {
                    holofoil: { market: 461.52, directLow: null }
                },
                url: 'https://www.tcgplayer.com/product/42382/pokemon-base-set-charizard',
                updatedAt: '2025/08/23'
            },
            cardmarket_data: {
                prices: {
                    averageSellPrice: 1735.75,
                    lowPrice: 700,
                    trendPrice: 2905.72
                },
                url: 'https://prices.pokemontcg.io/cardmarket/base1-4',
                updatedAt: '2025/08/14'
            }
        },
        {
            price_tracker_id: 'base1-58',
            name: 'Pikachu',
            number: '58',
            rarity: 'Common',
            set_id: 'base1',
            set_name: 'Base',
            set_series: 'Base',
            set_printed_total: 102,
            set_total: 102,
            set_release_date: '1999/01/09',
            set_ptcgo_code: 'BS',
            image_small: 'https://images.pokemontcg.io/base1/58.png',
            market_price: 25.50,
            price_source: 'tcgplayer',
            tcgplayer_data: {
                prices: {
                    normal: { market: 25.50, directLow: 22.00 }
                }
            }
        },
        {
            price_tracker_id: 'base1-15',
            name: 'Venusaur',
            number: '15',
            rarity: 'Rare Holo',
            set_id: 'base1',
            set_name: 'Base',
            set_series: 'Base',
            set_printed_total: 102,
            set_total: 102,
            set_release_date: '1999/01/09',
            set_ptcgo_code: 'BS',
            image_small: 'https://images.pokemontcg.io/base1/15.png',
            market_price: 125.75,
            price_source: 'cardmarket',
            cardmarket_data: {
                prices: {
                    averageSellPrice: 125.75,
                    lowPrice: 95.00,
                    trendPrice: 140.50
                }
            }
        },
        {
            price_tracker_id: 'base1-2',
            name: 'Blastoise',
            number: '2',
            rarity: 'Rare Holo',
            set_id: 'base1',
            set_name: 'Base',
            set_series: 'Base',
            set_printed_total: 102,
            set_total: 102,
            set_release_date: '1999/01/09',
            set_ptcgo_code: 'BS',
            image_small: 'https://images.pokemontcg.io/base1/2.png',
            market_price: 185.25,
            price_source: 'tcgplayer',
            tcgplayer_data: {
                prices: {
                    holofoil: { market: 185.25, directLow: 160.00 }
                }
            }
        },
        {
            price_tracker_id: 'jungle-7',
            name: 'Flareon',
            number: '7',
            rarity: 'Rare Holo',
            set_id: 'jungle',
            set_name: 'Jungle',
            set_series: 'Base',
            set_printed_total: 64,
            set_total: 64,
            set_release_date: '1999/06/16',
            set_ptcgo_code: 'JU',
            image_small: 'https://images.pokemontcg.io/jungle/7.png',
            market_price: 45.80,
            price_source: 'tcgplayer'
        }
    ];

    console.log('🃏 Creating sample cards...');
    // Explicitly type the array
    const createdCards: Card[] = [];
    for (const cardData of sampleCards) {
        const card = await prisma.card.create({
            data: {
                ...cardData,
                card_number: cardData.number,
                last_updated: new Date(),
                source: 'API',
                sync_enabled: true,
                sync_errors: 0,
                featured: cardData.name === 'Charizard',
                view_count: Math.floor(Math.random() * 100)
            }
        });
        createdCards.push(card);
        console.log(`🃏 Created card: ${card.name} - $${card.market_price}`);
    }

    // Create price history for cards
    console.log('📊 Creating price history...');
    for (const card of createdCards) {
        const basePrice = Number(card.market_price) || 50;
        for (let i = 0; i < 5; i++) {
            const daysAgo = (i + 1) * 7;
            const priceVariation = (Math.random() - 0.5) * 0.2;
            const historicalPrice = basePrice * (1 + priceVariation);

            await prisma.price_history.create({
                data: {
                    card_id: card.id,
                    price: historicalPrice,
                    source: 'pokemon_price_tracker',
                    price_type: 'market',
                    recorded_at: new Date(Date.now() - (daysAgo * 24 * 60 * 60 * 1000)),
                    metadata: {
                        historical_data: true,
                        price_variation: priceVariation,
                        original_price: basePrice
                    }
                }
            });
        }
    }

    // Create some UserCards
    console.log('👥 Creating user card ownership...');
    for (let i = 0; i < createdUsers.length; i++) {
        const user = createdUsers[i];
        const cardCount = Math.floor(Math.random() * 2) + 1;

        for (let j = 0; j < cardCount; j++) {
            const randomCard = createdCards[Math.floor(Math.random() * createdCards.length)];

            await prisma.userCard.create({
                data: {
                    owner_id: user.id,
                    card_id: randomCard.id,
                    condition: ['Near Mint', 'Lightly Played', 'Moderately Played'][Math.floor(Math.random() * 3)],
                    is_for_sale: Math.random() > 0.5,
                    sale_type: Math.random() > 0.5 ? 'fixed' : 'auction',
                    fixed_price: Number(randomCard.market_price) * (1.1 + Math.random() * 0.3),
                    notes: `Owned by ${user.name}`
                }
            });
        }
    }

    // Create notifications
    for (const user of createdUsers) {
        await prisma.notification.create({
            data: {
                user_id: user.id,
                type: 'welcome',
                title: 'Welcome to TCG Market!',
                message: 'Your account has been created successfully. Start trading Pokemon cards with real market prices!',
                data: {
                    welcome: true,
                    cards_available: createdCards.length
                },
                read: false
            }
        });
    }

    // Create admin notification
    await prisma.notification.create({
        data: {
            user_id: admin.id,
            type: 'admin',
            title: 'Database Initialized',
            message: `System ready with ${createdCards.length} sample cards and ${createdUsers.length} test users.`,
            data: {
                admin_setup: true,
                card_count: createdCards.length,
                user_count: createdUsers.length
            },
            read: false
        }
    });

    console.log('\n🎉 Database seeded successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('👨‍💼 Admin: admin@gmail.com / admin123');
    console.log('👥 Users: john@test.com, sarah@test.com, mike@test.com / user123');
    console.log(`\n🃏 Created ${createdCards.length} sample Pokemon cards with pricing data`);
    console.log('💰 All users have wallets with starting balance');
    console.log('📊 Price history created for all cards');
    console.log('\n🚀 Ready to test card import and price sync!');
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });