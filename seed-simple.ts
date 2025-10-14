// seed-simple.ts - Working version for current schema
import { PrismaClient } from '@prisma/client';
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
            registeredAt: new Date(),
        }
    });
    console.log('✅ Created admin user:', admin.email);

    // Create Test Users
    const hashedUserPassword = await bcrypt.hash('user123', 12);

    const testUsers = [
        { email: 'john@test.com', name: 'John Collector' },
        { email: 'sarah@test.com', name: 'Sarah Trainer' },
        { email: 'mike@test.com', name: 'Mike Trader' },
        { email: 'emma@test.com', name: 'Emma CardMaster' },
        { email: 'alex@test.com', name: 'Alex Pokemon' }
    ];

    const createdUsers = [];
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
                registeredAt: new Date(),
                last_login_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
            }
        });
        createdUsers.push(user);
        console.log(`✅ Created test user: ${user.email}`);
    }

    // Create User Wallets
    for (const user of [admin, ...createdUsers]) {
        await prisma.userWallet.upsert({
            where: { user_id: user.id },
            update: {},
            create: {
                user_id: user.id,
                balance: user.role === 'admin' ? 10000.00 : 500.00,
                frozen_balance: 0.00
            }
        });
        console.log(`💰 Created wallet for ${user.name}: $${user.role === 'admin' ? '10000' : '500'}`);
    }

    // Create Sample Cards - using exact field names from your schema
    console.log('🃏 Creating sample cards...');

    const cards = [];

    // Charizard
    const charizard = await prisma.card.create({
        data: {
            price_tracker_id: 'base1-4',
            tcg_player_id: 'base1-4-tcg',
            name: 'Charizard',
            card_number: '4',
            total_set_number: '102',
            rarity: 'Holo Rare',
            card_type: 'Pokemon',
            hp: 120,
            stage: 'Stage 2',
            set_id: 'base1',
            set_name: 'Base Set',
            image_url: 'https://images.pokemontcg.io/base1/4.png',
            market_price: 461.52,
            price_listings: 25,
            primary_condition: 'Near Mint',
            price_last_updated: new Date(),
            tcg_player_url: 'https://www.tcgplayer.com/product/42382/pokemon-base-set-charizard',
            artist: 'Mitsuhiro Arita',
            retreat_cost: 3,
            data_completeness: 95,
            needs_detailed_scrape: false,
            last_scraped_at: new Date(),
            attacks_data: {
                attacks: [{
                    name: 'Fire Spin',
                    cost: ['Fire', 'Fire', 'Fire', 'Fire'],
                    damage: '100',
                    text: 'Discard 2 Energy cards attached to Charizard in order to use this attack.'
                }]
            },
            weakness_data: { type: 'Water', value: '×2' },
            prices_data: {
                tcgplayer: {
                    prices: { holofoil: { market: 461.52, directLow: 420.00 } },
                    url: 'https://www.tcgplayer.com/product/42382/pokemon-base-set-charizard',
                    updatedAt: '2025/08/23'
                }
            },
            price_source: 'pokemon_price_tracker',
            last_updated: new Date(),
            sync_enabled: true,
            sync_errors: 0,
            source: 'API',
            featured: true,
            view_count: 150
        }
    });
    cards.push(charizard);

    // Pikachu
    const pikachu = await prisma.card.create({
        data: {
            price_tracker_id: 'base1-58',
            tcg_player_id: 'base1-58-tcg',
            name: 'Pikachu',
            card_number: '58',
            total_set_number: '102',
            rarity: 'Common',
            card_type: 'Pokemon',
            hp: 40,
            stage: 'Basic',
            set_id: 'base1',
            set_name: 'Base Set',
            image_url: 'https://images.pokemontcg.io/base1/58.png',
            market_price: 25.50,
            price_listings: 150,
            primary_condition: 'Near Mint',
            price_last_updated: new Date(),
            artist: 'Atsuko Nishida',
            retreat_cost: 1,
            data_completeness: 90,
            attacks_data: {
                attacks: [{
                    name: 'Thunder Shock',
                    cost: ['Electric'],
                    damage: '10',
                    text: 'Flip a coin. If heads, the Defending Pokémon is now Paralyzed.'
                }]
            },
            weakness_data: { type: 'Fighting', value: '×2' },
            prices_data: {
                tcgplayer: {
                    prices: { normal: { market: 25.50, directLow: 22.00 } }
                }
            },
            last_updated: new Date(),
            sync_enabled: true,
            source: 'API',
            view_count: 75
        }
    });
    cards.push(pikachu);

    // Venusaur
    const venusaur = await prisma.card.create({
        data: {
            price_tracker_id: 'base1-15',
            tcg_player_id: 'base1-15-tcg',
            name: 'Venusaur',
            card_number: '15',
            total_set_number: '102',
            rarity: 'Holo Rare',
            card_type: 'Pokemon',
            hp: 100,
            stage: 'Stage 2',
            set_id: 'base1',
            set_name: 'Base Set',
            image_url: 'https://images.pokemontcg.io/base1/15.png',
            market_price: 125.75,
            price_listings: 45,
            primary_condition: 'Near Mint',
            price_last_updated: new Date(),
            artist: 'Mitsuhiro Arita',
            retreat_cost: 2,
            data_completeness: 85,
            attacks_data: {
                attacks: [{
                    name: 'Solar Beam',
                    cost: ['Grass', 'Grass', 'Grass', 'Grass'],
                    damage: '60',
                    text: ''
                }]
            },
            weakness_data: { type: 'Fire', value: '×2' },
            last_updated: new Date(),
            sync_enabled: true,
            source: 'API',
            view_count: 90
        }
    });
    cards.push(venusaur);

    // Blastoise
    const blastoise = await prisma.card.create({
        data: {
            price_tracker_id: 'base1-2',
            tcg_player_id: 'base1-2-tcg',
            name: 'Blastoise',
            card_number: '2',
            total_set_number: '102',
            rarity: 'Holo Rare',
            card_type: 'Pokemon',
            hp: 100,
            stage: 'Stage 2',
            set_id: 'base1',
            set_name: 'Base Set',
            image_url: 'https://images.pokemontcg.io/base1/2.png',
            market_price: 185.25,
            price_listings: 32,
            primary_condition: 'Near Mint',
            price_last_updated: new Date(),
            artist: 'Mitsuhiro Arita',
            retreat_cost: 3,
            data_completeness: 88,
            last_updated: new Date(),
            sync_enabled: true,
            source: 'API',
            view_count: 65
        }
    });
    cards.push(blastoise);

    // Professor Oak (Trainer)
    const professorOak = await prisma.card.create({
        data: {
            price_tracker_id: 'base1-88',
            tcg_player_id: 'base1-88-tcg',
            name: 'Professor Oak',
            card_number: '88',
            total_set_number: '102',
            rarity: 'Uncommon',
            card_type: 'Trainer',
            set_id: 'base1',
            set_name: 'Base Set',
            image_url: 'https://images.pokemontcg.io/base1/88.png',
            market_price: 15.75,
            price_listings: 85,
            primary_condition: 'Near Mint',
            price_last_updated: new Date(),
            artist: 'Ken Sugimori',
            data_completeness: 75,
            last_updated: new Date(),
            sync_enabled: true,
            source: 'API',
            view_count: 30
        }
    });
    cards.push(professorOak);

    console.log(`🃏 Created ${cards.length} sample cards`);

    // Create price history for cards
    console.log('📊 Creating price history...');
    for (const card of cards) {
        const basePrice = Number(card.market_price) || 50;
        for (let i = 0; i < 10; i++) {
            const daysAgo = (i + 1) * 3;
            const priceVariation = (Math.random() - 0.5) * 0.15;
            const historicalPrice = Math.max(basePrice * (1 + priceVariation), 0.50);

            await prisma.price_history.create({
                data: {
                    card_id: card.id,
                    price: historicalPrice,
                    source: 'pokemon_price_tracker_v2',
                    price_type: 'market',
                    condition: 'Near Mint',
                    recorded_at: new Date(Date.now() - (daysAgo * 24 * 60 * 60 * 1000)),
                    tcg_player_id: card.tcg_player_id,
                    listing_count: Math.floor(Math.random() * 50) + 10,
                    data_source: 'pokemon_price_tracker',
                    metadata: {
                        historical_data: true,
                        price_variation: priceVariation,
                        original_price: basePrice,
                        days_ago: daysAgo
                    }
                }
            });
        }
    }

    // Create some UserCards
    console.log('👥 Creating user card ownership...');
    for (let i = 0; i < createdUsers.length; i++) {
        const user = createdUsers[i];
        const cardCount = Math.floor(Math.random() * 3) + 2;

        for (let j = 0; j < cardCount; j++) {
            const randomCard = cards[Math.floor(Math.random() * cards.length)];
            const isForSale = Math.random() > 0.4;
            const saleType = Math.random() > 0.5 ? 'FIXED' : 'AUCTION';
            const basePrice = Number(randomCard.market_price) || 50;
            const priceMultiplier = 0.9 + Math.random() * 0.4;

            try {
                await prisma.userCard.create({
                    data: {
                        owner_id: user.id,
                        card_id: randomCard.id,
                        condition: ['Near Mint', 'Lightly Played', 'Moderately Played'][Math.floor(Math.random() * 3)],
                        is_for_sale: isForSale,
                        sale_type: isForSale ? saleType : null,
                        fixed_price: isForSale && saleType === 'FIXED' ? basePrice * priceMultiplier : null,
                        reserve_price: isForSale && saleType === 'AUCTION' ? basePrice * 0.8 : null,
                        auction_end: isForSale && saleType === 'AUCTION' ?
                            new Date(Date.now() + (Math.random() * 7 + 1) * 24 * 60 * 60 * 1000) : null,
                        is_sold: false,
                        notes: `Owned by ${user.name}`,
                        acquired_date: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000)
                    }
                });
            } catch (error) {
                console.error(`❌ Failed to create user card for ${user.name}:`, error);
            }
        }
    }

    // Create notifications
    console.log('🔔 Creating notifications...');
    for (const user of createdUsers) {
        await prisma.notification.create({
            data: {
                user_id: user.id,
                type: 'welcome',
                title: 'Welcome to TCG Market!',
                message: 'Your account has been created successfully. Start trading Pokemon cards with real market prices!',
                data: {
                    welcome: true,
                    cards_available: cards.length,
                    market_ready: true
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
            title: 'Database Initialized Successfully',
            message: `System ready with ${cards.length} sample cards, ${createdUsers.length} test users, active marketplace, and price tracking enabled.`,
            data: {
                admin_setup: true,
                card_count: cards.length,
                user_count: createdUsers.length,
                system_status: 'ready'
            },
            read: false
        }
    });

    // Create admin wallet
    await prisma.admin_wallet.create({
        data: {
            wallet_type: 'PLATFORM',
            balance: 0.00,
            total_commissions: 0.00,
            total_marketplace_sales: 0.00
        }
    });

    // Create commission settings
    await prisma.commission_settings.createMany({
        data: [
            {
                setting_type: 'GLOBAL',
                setting_key: 'marketplace',
                commission_rate: 5.0,
                is_active: true,
                created_by: admin.id
            },
            {
                setting_type: 'RARITY',
                setting_key: 'Rare',
                commission_rate: 3.0,
                is_active: true,
                created_by: admin.id
            }
        ]
    });

    console.log('\n🎉 Database seeded successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('👨‍💼 Admin: admin@gmail.com / admin123');
    console.log('👥 Users: john@test.com, sarah@test.com, mike@test.com, emma@test.com, alex@test.com / user123');
    console.log(`\n📊 Statistics:`);
    console.log(`🃏 ${cards.length} Pokemon cards with full pricing data`);
    console.log(`👥 ${createdUsers.length + 1} users (${createdUsers.length} regular + 1 admin)`);
    console.log(`💰 All users have wallets with starting balance`);
    console.log(`📊 Price history created for all cards`);
    console.log(`🏪 User cards created with marketplace listings`);
    console.log(`🔔 Notifications system ready`);
    console.log(`⚙️ Admin wallet and commission settings configured`);
    console.log('\n🚀 Ready to test the professional card import system!');
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        console.error('Stack trace:', e.stack);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });