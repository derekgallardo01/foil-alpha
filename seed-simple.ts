// prisma/seed.ts - Fixed version with proper typing
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting seed...');

    // Clear existing data in correct order (respecting foreign keys)
    console.log('🧹 Cleaning existing data...');

    try {
        await prisma.price_history.deleteMany();
        await prisma.bid.deleteMany();
        await prisma.cardTransactionHistory.deleteMany();
        await prisma.walletTransaction.deleteMany();
        await prisma.notification.deleteMany();
        await prisma.userCard.deleteMany();
        await prisma.userWallet.deleteMany();
        await prisma.activityLog.deleteMany();
        await prisma.watchlist.deleteMany();
        await prisma.card.deleteMany();
        await prisma.pokemonSet.deleteMany();
        await prisma.rarity.deleteMany();
        await prisma.subtype.deleteMany();
        await prisma.supertype.deleteMany();
        await prisma.user.deleteMany();
    } catch (error) {
        console.log('Some tables may not exist yet, continuing...');
    }

    // 1. Create Users
    console.log('👥 Creating users...');

    const adminPassword = await bcrypt.hash('123', 10);
    const userPassword = await bcrypt.hash('user123', 10);

    const admin = await prisma.user.create({
        data: {
            email: 'admin@test.com',
            name: 'Admin User',
            password: adminPassword,
            role: 'admin',
            subscriptionStatus: 'active',
            is_verified: 1,
            registeredAt: new Date(),
        },
    });

    const user1 = await prisma.user.create({
        data: {
            email: 'collector1@test.com',
            name: 'Pokemon Collector 1',
            password: userPassword,
            role: 'user',
            subscriptionStatus: 'active',
            is_verified: 1,
            registeredAt: new Date(),
        },
    });

    const user2 = await prisma.user.create({
        data: {
            email: 'collector2@test.com',
            name: 'Pokemon Collector 2',
            password: userPassword,
            role: 'user',
            subscriptionStatus: 'active',
            is_verified: 1,
            registeredAt: new Date(),
        },
    });

    const user3 = await prisma.user.create({
        data: {
            email: 'trader@test.com',
            name: 'Card Trader',
            password: userPassword,
            role: 'user',
            subscriptionStatus: 'premium',
            is_verified: 1,
            registeredAt: new Date(),
        },
    });

    const users = [user1, user2, user3];
    console.log(`✅ Created admin and ${users.length} users`);

    // 2. Create User Wallets
    console.log('💰 Creating user wallets...');

    await prisma.userWallet.create({
        data: {
            user_id: admin.id,
            balance: 10000.00,
            frozen_balance: 0.00,
        },
    });

    for (const user of users) {
        await prisma.userWallet.create({
            data: {
                user_id: user.id,
                balance: 500.00 + Math.random() * 1000, // Random balance between 500-1500
                frozen_balance: Math.random() * 100, // Random frozen amount
            },
        });
    }

    // 3. Create Pokemon Sets
    console.log('📦 Creating Pokemon sets...');

    const baseSet = await prisma.pokemonSet.create({
        data: {
            id: 'base1',
            name: 'Base Set',
            series: 'Base',
            printed_total: 102,
            total: 102,
            release_date: '1999-01-09',
            ptcgo_code: 'BS',
            images: {
                symbol: 'https://images.pokemontcg.io/base1/symbol.png',
                logo: 'https://images.pokemontcg.io/base1/logo.png'
            } as any,
            legalities: {
                unlimited: 'Legal',
                standard: 'Legal'
            } as any,
        },
    });

    const xySet = await prisma.pokemonSet.create({
        data: {
            id: 'xy1',
            name: 'XY',
            series: 'XY',
            printed_total: 146,
            total: 146,
            release_date: '2014-02-05',
            ptcgo_code: 'XY',
            images: {
                symbol: 'https://images.pokemontcg.io/xy1/symbol.png',
                logo: 'https://images.pokemontcg.io/xy1/logo.png'
            } as any,
            legalities: {
                unlimited: 'Legal',
                expanded: 'Legal'
            } as any,
        },
    });

    // 4. Create Rarities
    console.log('💎 Creating rarities...');

    const commonRarity = await prisma.rarity.create({
        data: {
            name: 'Common',
            symbol: '●',
            order_index: 1,
            color: '#666666',
            description: 'Common cards',
        },
    });

    const holoRarity = await prisma.rarity.create({
        data: {
            name: 'Holo Rare',
            symbol: '★',
            order_index: 4,
            color: '#FF6B6B',
            description: 'Holographic rare cards',
        },
    });

    const ultraRarity = await prisma.rarity.create({
        data: {
            name: 'Ultra Rare',
            symbol: '★★',
            order_index: 5,
            color: '#9B59B6',
            description: 'Ultra rare cards',
        },
    });

    // 5. Create Supertypes
    console.log('⚡ Creating supertypes...');

    const pokemonSupertype = await prisma.supertype.create({
        data: {
            name: 'Pokémon',
            description: 'Pokémon cards',
            order_index: 1,
        },
    });

    const trainerSupertype = await prisma.supertype.create({
        data: {
            name: 'Trainer',
            description: 'Trainer cards',
            order_index: 2,
        },
    });

    // 6. Create Subtypes
    console.log('🔧 Creating subtypes...');

    const basicSubtype = await prisma.subtype.create({
        data: {
            name: 'Basic',
            category: 'Pokemon',
            description: 'Basic Pokémon',
            order_index: 1,
        },
    });

    const stage1Subtype = await prisma.subtype.create({
        data: {
            name: 'Stage 1',
            category: 'Pokemon',
            description: 'Stage 1 Evolution',
            order_index: 2,
        },
    });

    const stage2Subtype = await prisma.subtype.create({
        data: {
            name: 'Stage 2',
            category: 'Pokemon',
            description: 'Stage 2 Evolution',
            order_index: 3,
        },
    });

    const supporterSubtype = await prisma.subtype.create({
        data: {
            name: 'Supporter',
            category: 'Trainer',
            description: 'Supporter cards',
            order_index: 4,
        },
    });

    // 7. Create Cards with realistic pricing data
    console.log('🃏 Creating cards...');

    const charizard = await prisma.card.create({
        data: {
            name: 'Charizard',
            set_name: 'Base Set',
            set_number: '4',
            rarity: 'Holo Rare',
            card_type: 'Pokemon',
            hp: 120,
            set_id: baseSet.id,
            rarity_id: holoRarity.id,
            supertype_id: pokemonSupertype.id,
            subtype_id: stage2Subtype.id,
            api_id: 'base1-4',
            market_price: 350.00,
            price_trend: 'up',
            holographic: true,
            image_url: 'https://images.pokemontcg.io/base1/4_hires.png',
            small_image_url: 'https://images.pokemontcg.io/base1/4.png',
            source: 'API',
            sync_enabled: true,
            last_price_update: new Date(),
            artist: 'Mitsuhiro Arita',
            types: ['Fire'] as any,
            attacks: [{
                name: 'Fire Spin',
                cost: ['Fire', 'Fire', 'Fire', 'Fire'],
                damage: '100',
                text: 'Discard 2 Energy cards attached to Charizard in order to use this attack.'
            }] as any,
            retreat_cost: ['Colorless', 'Colorless', 'Colorless'] as any,
            retreat_cost_count: 3,
        },
    });

    const blastoise = await prisma.card.create({
        data: {
            name: 'Blastoise',
            set_name: 'Base Set',
            set_number: '2',
            rarity: 'Holo Rare',
            card_type: 'Pokemon',
            hp: 100,
            set_id: baseSet.id,
            rarity_id: holoRarity.id,
            supertype_id: pokemonSupertype.id,
            subtype_id: stage2Subtype.id,
            api_id: 'base1-2',
            market_price: 275.00,
            price_trend: 'stable',
            holographic: true,
            image_url: 'https://images.pokemontcg.io/base1/2_hires.png',
            small_image_url: 'https://images.pokemontcg.io/base1/2.png',
            source: 'API',
            sync_enabled: true,
            last_price_update: new Date(),
            artist: 'Ken Sugimori',
            types: ['Water'] as any,
            retreat_cost: ['Colorless', 'Colorless', 'Colorless'] as any,
            retreat_cost_count: 3,
        },
    });

    const venusaur = await prisma.card.create({
        data: {
            name: 'Venusaur',
            set_name: 'Base Set',
            set_number: '15',
            rarity: 'Holo Rare',
            card_type: 'Pokemon',
            hp: 100,
            set_id: baseSet.id,
            rarity_id: holoRarity.id,
            supertype_id: pokemonSupertype.id,
            subtype_id: stage2Subtype.id,
            api_id: 'base1-15',
            market_price: 225.00,
            price_trend: 'up',
            holographic: true,
            image_url: 'https://images.pokemontcg.io/base1/15_hires.png',
            small_image_url: 'https://images.pokemontcg.io/base1/15.png',
            source: 'API',
            sync_enabled: true,
            last_price_update: new Date(),
            artist: 'Ken Sugimori',
            types: ['Grass'] as any,
            retreat_cost: ['Colorless', 'Colorless'] as any,
            retreat_cost_count: 2,
        },
    });

    const pikachu = await prisma.card.create({
        data: {
            name: 'Pikachu',
            set_name: 'XY',
            set_number: '42',
            rarity: 'Common',
            card_type: 'Pokemon',
            hp: 60,
            set_id: xySet.id,
            rarity_id: commonRarity.id,
            supertype_id: pokemonSupertype.id,
            subtype_id: basicSubtype.id,
            api_id: 'xy1-42',
            market_price: 2.50,
            price_trend: 'stable',
            image_url: 'https://images.pokemontcg.io/xy1/42_hires.png',
            small_image_url: 'https://images.pokemontcg.io/xy1/42.png',
            source: 'API',
            sync_enabled: true,
            last_price_update: new Date(),
            artist: 'Atsuko Nishida',
            types: ['Lightning'] as any,
            retreat_cost: ['Colorless'] as any,
            retreat_cost_count: 1,
        },
    });

    const professorOak = await prisma.card.create({
        data: {
            name: 'Professor Oak',
            set_name: 'Base Set',
            set_number: '88',
            rarity: 'Uncommon',
            card_type: 'Trainer',
            set_id: baseSet.id,
            rarity_id: commonRarity.id, // Using common rarity for trainer
            supertype_id: trainerSupertype.id,
            subtype_id: supporterSubtype.id,
            api_id: 'base1-88',
            market_price: 15.00,
            price_trend: 'down',
            image_url: 'https://images.pokemontcg.io/base1/88_hires.png',
            small_image_url: 'https://images.pokemontcg.io/base1/88.png',
            source: 'API',
            sync_enabled: true,
            last_price_update: new Date(),
            artist: 'Ken Sugimori',
        },
    });

    const cards = [charizard, blastoise, venusaur, pikachu, professorOak];
    console.log(`✅ Created ${cards.length} cards`);

    // 8. Create Price History for realistic chart data
    console.log('📈 Creating price history...');

    const now = new Date();
    let priceHistoryCount = 0;

    for (const card of cards) {
        // Create 30 days of price history for each card
        for (let i = 30; i >= 0; i--) {
            const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));

            // Generate realistic price fluctuations
            const basePrice = Number(card.market_price);
            const variation = (Math.random() - 0.5) * 0.2; // ±10% variation
            const price = basePrice * (1 + variation);

            await prisma.price_history.create({
                data: {
                    card_id: card.id,
                    price: Math.max(0.25, price), // Minimum price of $0.25
                    source: 'pokemon_price_tracker',
                    recorded_at: date,
                    metadata: {
                        price_change_24h: (Math.random() - 0.5) * 10, // ±5% daily change
                        volume_24h: Math.floor(Math.random() * 100) + 10,
                        trend_analysis: 'auto_generated',
                        is_seed_data: true,
                    } as any,
                },
            });
            priceHistoryCount++;
        }
    }

    console.log(`✅ Created ${priceHistoryCount} price history entries`);

    // 9. Create User Cards (collections)
    console.log('🎴 Creating user card collections...');

    // User 1 (collector1) - owns Charizard (for sale), Pikachu
    const userCard1 = await prisma.userCard.create({
        data: {
            owner_id: user1.id,
            card_id: charizard.id,
            condition: 'Near Mint',
            is_for_sale: true,
            sale_type: 'FIXED',
            fixed_price: 380.00, // Slightly above market price
            acquired_date: new Date('2023-12-01'),
            notes: 'Perfect condition, just graded',
        },
    });

    const userCard2 = await prisma.userCard.create({
        data: {
            owner_id: user1.id,
            card_id: pikachu.id,
            condition: 'Mint',
            is_for_sale: false,
            acquired_date: new Date('2024-01-15'),
            notes: 'Personal collection',
        },
    });

    // User 2 (collector2) - owns Blastoise (auction), Professor Oak
    const userCard3 = await prisma.userCard.create({
        data: {
            owner_id: user2.id,
            card_id: blastoise.id,
            condition: 'Light Play',
            is_for_sale: true,
            sale_type: 'AUCTION',
            reserve_price: 250.00,
            auction_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            acquired_date: new Date('2023-11-20'),
            notes: 'Slight edge wear but still beautiful',
        },
    });

    const userCard4 = await prisma.userCard.create({
        data: {
            owner_id: user2.id,
            card_id: professorOak.id,
            condition: 'Near Mint',
            is_for_sale: false,
            acquired_date: new Date('2024-02-01'),
            notes: 'Nostalgic trainer card',
        },
    });

    // User 3 (trader) - owns Venusaur (for sale)
    const userCard5 = await prisma.userCard.create({
        data: {
            owner_id: user3.id,
            card_id: venusaur.id,
            condition: 'Mint',
            is_for_sale: true,
            sale_type: 'FIXED',
            fixed_price: 240.00, // Slightly above market
            acquired_date: new Date('2023-10-10'),
            notes: 'Completed the base set trio!',
        },
    });

    const userCards = [userCard1, userCard2, userCard3, userCard4, userCard5];
    console.log(`✅ Created ${userCards.length} user cards`);

    // 10. Create some bids on auction items
    console.log('💰 Creating bids...');

    const auctionUserCard = userCards.find(uc => uc.sale_type === 'AUCTION');
    if (auctionUserCard) {
        await prisma.bid.create({
            data: {
                userCardId: auctionUserCard.id,
                bidderId: user1.id, // collector1 bids on collector2's Blastoise
                amount: 260.00,
                createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
            },
        });

        await prisma.bid.create({
            data: {
                userCardId: auctionUserCard.id,
                bidderId: user3.id, // trader bids higher
                amount: 280.00,
                createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
            },
        });
    }

    // 11. Create some notifications
    console.log('🔔 Creating notifications...');

    await prisma.notification.create({
        data: {
            user_id: user1.id,
            type: 'price_alert',
            title: 'Price Alert: Charizard',
            message: 'Your Charizard has increased in value by 5% in the last 24 hours!',
            data: {
                card_id: charizard.id,
                old_price: 333.00,
                new_price: 350.00,
                change_percent: 5.1,
            } as any,
        },
    });

    await prisma.notification.create({
        data: {
            user_id: user2.id,
            type: 'bid_received',
            title: 'New Bid on Your Blastoise',
            message: 'Someone placed a bid of $280.00 on your Blastoise auction!',
            data: {
                user_card_id: auctionUserCard?.id,
                bid_amount: 280.00,
                bidder_name: 'Card Trader',
            } as any,
        },
    });

    // 12. Create some activity logs
    console.log('📊 Creating activity logs...');

    await prisma.activityLog.create({
        data: {
            userId: admin.id,
            action: 'price_sync_completed',
            timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        },
    });

    await prisma.activityLog.create({
        data: {
            userId: user1.id,
            action: 'card_listed_for_sale',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        },
    });

    console.log('🎉 Seed completed successfully!');

    // Print summary
    console.log('\n📋 SEED SUMMARY:');
    console.log('================');
    console.log(`👑 Admin User: admin@test.com (password: 123)`);
    console.log(`👥 Regular Users: ${users.length}`);
    console.log(`   • collector1@test.com (password: user123)`);
    console.log(`   • collector2@test.com (password: user123)`);
    console.log(`   • trader@test.com (password: user123)`);
    console.log(`🃏 Cards: ${cards.length}`);
    console.log(`📈 Price History Entries: ${priceHistoryCount}`);
    console.log(`🎴 User Cards (Collection): ${userCards.length}`);
    console.log(`💰 Cards for Sale: ${userCards.filter(uc => uc.is_for_sale).length}`);
    console.log(`🏷️  Fixed Price Listings: ${userCards.filter(uc => uc.sale_type === 'FIXED').length}`);
    console.log(`⏰ Auction Listings: ${userCards.filter(uc => uc.sale_type === 'AUCTION').length}`);
    console.log('\n🚀 You can now test:');
    console.log('   • Admin price sync at /admin/pricing/update');
    console.log('   • User collections and marketplace');
    console.log('   • Price charts and history');
    console.log('   • Bidding on auctions');
    console.log('   • Price tracking functionality');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });