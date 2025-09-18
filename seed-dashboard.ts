// seed-dashboard.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Sample Pokemon cards data with realistic pricing and popularity
const sampleCards = [
    // High-value trending cards
    {
        name: "Charizard VMAX",
        set_name: "Champion's Path",
        set_id: "swsh35",
        card_number: "020",
        rarity: "VMAX",
        card_type: "Fire",
        hp: 330,
        image_url: "https://images.pokemontcg.io/swsh35/20_hires.png",
        market_price: 245.50,
        view_count: 15420,
        price_trend: "up",
        price_change: 12.5
    },
    {
        name: "Pikachu VMAX",
        set_name: "Vivid Voltage",
        set_id: "swsh4",
        card_number: "044",
        rarity: "VMAX",
        card_type: "Lightning",
        hp: 310,
        image_url: "https://images.pokemontcg.io/swsh4/44_hires.png",
        market_price: 89.99,
        view_count: 12850,
        price_trend: "up",
        price_change: 8.3
    },
    {
        name: "Umbreon VMAX",
        set_name: "Evolving Skies",
        set_id: "swsh7",
        card_number: "095",
        rarity: "VMAX",
        card_type: "Darkness",
        hp: 310,
        image_url: "https://images.pokemontcg.io/swsh7/95_hires.png",
        market_price: 156.75,
        view_count: 9840,
        price_trend: "up",
        price_change: 15.2
    },
    {
        name: "Rayquaza VMAX",
        set_name: "Evolving Skies",
        set_id: "swsh7",
        card_number: "111",
        rarity: "VMAX",
        card_type: "Dragon",
        hp: 320,
        image_url: "https://images.pokemontcg.io/swsh7/111_hires.png",
        market_price: 198.25,
        view_count: 11200,
        price_trend: "up",
        price_change: 22.1
    },
    {
        name: "Mew VMAX",
        set_name: "Fusion Strike",
        set_id: "swsh8",
        card_number: "114",
        rarity: "VMAX",
        card_type: "Psychic",
        hp: 310,
        image_url: "https://images.pokemontcg.io/swsh8/114_hires.png",
        market_price: 67.50,
        view_count: 8950,
        price_trend: "stable",
        price_change: 2.1
    },

    // Popular mid-tier cards
    {
        name: "Lucario V",
        set_name: "Astral Radiance",
        set_id: "swsh10",
        card_number: "078",
        rarity: "Ultra Rare",
        card_type: "Fighting",
        hp: 210,
        image_url: "https://images.pokemontcg.io/swsh10/78_hires.png",
        market_price: 24.99,
        view_count: 7320,
        price_trend: "up",
        price_change: 5.8
    },
    {
        name: "Garchomp V",
        set_name: "Astral Radiance",
        set_id: "swsh10",
        card_number: "117",
        rarity: "Ultra Rare",
        card_type: "Dragon",
        hp: 200,
        image_url: "https://images.pokemontcg.io/swsh10/117_hires.png",
        market_price: 18.75,
        view_count: 6540,
        price_trend: "down",
        price_change: -3.2
    },
    {
        name: "Dialga VSTAR",
        set_name: "Astral Radiance",
        set_id: "swsh10",
        card_number: "099",
        rarity: "VSTAR",
        card_type: "Metal",
        hp: 280,
        image_url: "https://images.pokemontcg.io/swsh10/99_hires.png",
        market_price: 32.50,
        view_count: 8100,
        price_trend: "up",
        price_change: 7.9
    },
    {
        name: "Palkia VSTAR",
        set_name: "Astral Radiance",
        set_id: "swsh10",
        card_number: "040",
        rarity: "VSTAR",
        card_type: "Water",
        hp: 280,
        image_url: "https://images.pokemontcg.io/swsh10/40_hires.png",
        market_price: 28.99,
        view_count: 7650,
        price_trend: "stable",
        price_change: 1.5
    },
    {
        name: "Arceus VSTAR",
        set_name: "Brilliant Stars",
        set_id: "swsh9",
        card_number: "123",
        rarity: "VSTAR",
        card_type: "Colorless",
        hp: 280,
        image_url: "https://images.pokemontcg.io/swsh9/123_hires.png",
        market_price: 45.25,
        view_count: 9200,
        price_trend: "up",
        price_change: 11.3
    },

    // Classic popular cards
    {
        name: "Eevee",
        set_name: "Evolving Skies",
        set_id: "swsh7",
        card_number: "125",
        rarity: "Common",
        card_type: "Colorless",
        hp: 50,
        image_url: "https://images.pokemontcg.io/swsh7/125_hires.png",
        market_price: 3.99,
        view_count: 14500,
        price_trend: "stable",
        price_change: 0.5
    },
    {
        name: "Pikachu",
        set_name: "Celebrations",
        set_id: "cel25",
        card_number: "005",
        rarity: "Promo",
        card_type: "Lightning",
        hp: 60,
        image_url: "https://images.pokemontcg.io/cel25/5_hires.png",
        market_price: 8.50,
        view_count: 18200,
        price_trend: "up",
        price_change: 4.2
    },
    {
        name: "Gengar VMAX",
        set_name: "Fusion Strike",
        set_id: "swsh8",
        card_number: "157",
        rarity: "VMAX",
        card_type: "Psychic",
        hp: 320,
        image_url: "https://images.pokemontcg.io/swsh8/157_hires.png",
        market_price: 72.99,
        view_count: 6890,
        price_trend: "down",
        price_change: -5.1
    },
    {
        name: "Leafeon VMAX",
        set_name: "Evolving Skies",
        set_id: "swsh7",
        card_number: "008",
        rarity: "VMAX",
        card_type: "Grass",
        hp: 310,
        image_url: "https://images.pokemontcg.io/swsh7/8_hires.png",
        market_price: 41.75,
        view_count: 5420,
        price_trend: "up",
        price_change: 6.7
    },
    {
        name: "Sylveon VMAX",
        set_name: "Evolving Skies",
        set_id: "swsh7",
        card_number: "092",
        rarity: "VMAX",
        card_type: "Fairy",
        hp: 310,
        image_url: "https://images.pokemontcg.io/swsh7/92_hires.png",
        market_price: 58.25,
        view_count: 7100,
        price_trend: "stable",
        price_change: -1.2
    }
];

async function seedDashboardData() {
    console.log('🌱 Starting dashboard seed...');

    try {
        // First, create the cards with proper V2 API structure
        const createdCards = [];

        for (const cardData of sampleCards) {
            // Create unique price_tracker_id
            const priceTrackerId = `seed_${cardData.set_id}_${cardData.card_number}`;

            const card = await prisma.card.upsert({
                where: { price_tracker_id: priceTrackerId },
                update: {
                    market_price: cardData.market_price,
                    view_count: cardData.view_count,
                    last_updated: new Date(),
                    sync_enabled: true
                },
                create: {
                    // V2 API fields
                    price_tracker_id: priceTrackerId,
                    tcg_player_id: `tcg_${Math.random().toString(36).substring(7)}`,

                    // Basic card info
                    name: cardData.name,
                    card_number: cardData.card_number,
                    rarity: cardData.rarity,
                    card_type: cardData.card_type,
                    hp: cardData.hp,

                    // Set information
                    set_id: cardData.set_id,
                    set_name: cardData.set_name,

                    // Images
                    image_url: cardData.image_url,

                    // Pricing data
                    market_price: cardData.market_price,
                    primary_condition: 'Near Mint',
                    price_last_updated: new Date(),

                    // App-specific fields
                    source: 'API',
                    view_count: cardData.view_count,
                    sync_enabled: true,

                    // Timestamps
                    created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within last 30 days
                    updated_at: new Date()
                }
            });

            createdCards.push({ card, trend: cardData.price_trend, change: cardData.price_change });
            console.log(`✅ Created/Updated card: ${card.name}`);
        }

        console.log('📊 Creating price history for trends...');

        for (const { card, trend, change } of createdCards) {
            const currentPrice = parseFloat(card.market_price?.toString() || '0');
            const daysOfHistory = 7;

            // Calculate starting price based on trend - FIXED CALCULATION
            let startingPrice: number;
            if (trend === 'up') {
                // If current trend is up by X%, then starting price should be lower
                startingPrice = currentPrice / (1 + (change / 100));
            } else if (trend === 'down') {
                // If current trend is down by X%, then starting price should be higher  
                startingPrice = currentPrice / (1 + (change / 100)); // This handles negative change
            } else {
                // Stable with small variation
                startingPrice = currentPrice * (0.98 + Math.random() * 0.04);
            }

            // Ensure reasonable starting price
            startingPrice = Math.max(0.01, startingPrice);

            console.log(`Creating price history for ${card.name}: ${startingPrice.toFixed(2)} -> ${currentPrice.toFixed(2)} (${change.toFixed(1)}%)`);

            // Create price history points with proper progression
            for (let day = daysOfHistory; day >= 0; day--) {
                const date = new Date();
                date.setDate(date.getDate() - day);
                date.setHours(12, 0, 0, 0); // Set consistent time

                let dayPrice: number;
                const progress = (daysOfHistory - day) / daysOfHistory; // 0 to 1

                if (trend === 'up') {
                    // Gradual increase from starting to current price
                    dayPrice = startingPrice + ((currentPrice - startingPrice) * progress);
                    // Add some realistic fluctuation
                    dayPrice *= (0.95 + Math.random() * 0.1);
                } else if (trend === 'down') {
                    // Gradual decrease from starting to current price
                    dayPrice = startingPrice + ((currentPrice - startingPrice) * progress);
                    // Add some realistic fluctuation
                    dayPrice *= (0.95 + Math.random() * 0.1);
                } else {
                    // Stable with minor fluctuations around current price
                    const variation = 0.05; // 5% variation
                    dayPrice = currentPrice * (1 + (Math.random() - 0.5) * variation);
                }

                // Ensure minimum price
                dayPrice = Math.max(0.01, dayPrice);

                await prisma.price_history.create({
                    data: {
                        card_id: card.id,
                        price: dayPrice,
                        source: 'pokemon_price_tracker_v2',
                        price_type: 'market',
                        condition: 'Near Mint',
                        recorded_at: date,
                        tcg_player_id: card.tcg_player_id,
                        listing_count: Math.floor(Math.random() * 50) + 5, // Random listing count
                        metadata: {
                            trend_type: trend,
                            expected_change: change,
                            day_index: daysOfHistory - day
                        }
                    }
                });
            }

            console.log(`✅ Created price history for ${card.name}`);
        }

        // Create some sample users for auction/listing data
        console.log('👥 Creating sample users...');
        const sampleUsers = [];
        for (let i = 1; i <= 5; i++) {
            const user = await prisma.user.upsert({
                where: { email: `collector${i}@example.com` },
                update: {},
                create: {
                    email: `collector${i}@example.com`,
                    name: `Collector ${i}`,
                    password: 'hashed_password_placeholder',
                    role: 'user',
                    registeredAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000) // Random date within last year
                }
            });
            sampleUsers.push(user);
        }

        // Create user cards (owned cards) and some auctions
        console.log('🃏 Creating user collections and auctions...');
        const userCards = [];

        for (const { card } of createdCards.slice(0, 10)) { // Only first 10 cards
            const randomUser = sampleUsers[Math.floor(Math.random() * sampleUsers.length)];

            // Create owned card
            const userCard = await prisma.userCard.create({
                data: {
                    owner_id: randomUser.id,
                    card_id: card.id,
                    condition: ['Near Mint', 'Lightly Played', 'Moderately Played'][Math.floor(Math.random() * 3)],
                    is_for_sale: Math.random() > 0.5,
                    sale_type: Math.random() > 0.7 ? 'AUCTION' : 'FIXED_PRICE',
                    fixed_price: parseFloat(card.market_price?.toString() || '0') * (0.9 + Math.random() * 0.2),
                    reserve_price: parseFloat(card.market_price?.toString() || '0') * (0.8 + Math.random() * 0.1),
                    auction_end: Math.random() > 0.5 ? new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000) : null, // Random end time within 7 days
                    acquired_date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000)
                }
            });

            userCards.push(userCard);

            // Create some bids for auction items
            if (userCard.sale_type === 'AUCTION' && userCard.is_for_sale) {
                const bidCount = Math.floor(Math.random() * 5) + 1;
                for (let b = 0; b < bidCount; b++) {
                    const bidder = sampleUsers[Math.floor(Math.random() * sampleUsers.length)];
                    if (bidder.id !== randomUser.id) { // Don't bid on own auction
                        await prisma.bid.create({
                            data: {
                                userCardId: userCard.id,
                                bidderId: bidder.id,
                                amount: parseFloat((userCard.reserve_price || 0).toString()) * (1 + (b * 0.05)), // Incremental bids
                                is_active: b === bidCount - 1, // Only last bid is active
                                createdAt: new Date(Date.now() - (bidCount - b) * 60 * 60 * 1000) // Spaced out over hours
                            }
                        });
                    }
                }
            }
        }

        // Update view counts randomly to simulate activity
        console.log('📈 Adding view activity...');
        for (const { card } of createdCards) {
            const additionalViews = Math.floor(Math.random() * 100);
            await prisma.card.update({
                where: { id: card.id },
                data: {
                    view_count: card.view_count + additionalViews
                }
            });
        }

        // Create some sample transactions
        console.log('💰 Creating sample transactions...');
        const sampleTransactions = userCards.slice(0, 5);
        for (const userCard of sampleTransactions) {
            const buyer = sampleUsers[Math.floor(Math.random() * sampleUsers.length)];
            if (buyer.id !== userCard.owner_id) {
                await prisma.transaction.create({
                    data: {
                        user_card_id: userCard.id,
                        buyer_id: buyer.id,
                        seller_id: userCard.owner_id,
                        amount: parseFloat((userCard.fixed_price || 50).toString()),
                        transaction_type: 'PURCHASE',
                        status: Math.random() > 0.3 ? 'COMPLETED' : 'PENDING',
                        created_at: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000) // Within last 2 weeks
                    }
                });
            }
        }

        console.log('🎉 Dashboard seed completed successfully!');
        console.log(`✅ Created ${createdCards.length} cards`);
        console.log(`✅ Created ${sampleUsers.length} sample users`);
        console.log(`✅ Created ${userCards.length} user card entries`);
        console.log('✅ Generated price history, bids, and transactions');

        return {
            cards: createdCards.length,
            users: sampleUsers.length,
            userCards: userCards.length
        };

    } catch (error) {
        console.error('❌ Error seeding dashboard data:', error);
        throw error;
    }
}

// Cleanup function
async function cleanupSeedData() {
    console.log('🧹 Cleaning up previous seed data...');

    try {
        // Delete in correct order to avoid foreign key constraints
        await prisma.bid.deleteMany({
            where: {
                userCardId: {
                    in: await prisma.userCard.findMany({
                        where: {
                            card_id: {
                                in: await prisma.card.findMany({
                                    where: { price_tracker_id: { startsWith: 'seed_' } },
                                    select: { id: true }
                                }).then(cards => cards.map(c => c.id))
                            }
                        },
                        select: { id: true }
                    }).then(userCards => userCards.map(uc => uc.id))
                }
            }
        });

        await prisma.transaction.deleteMany({
            where: {
                user_card_id: {
                    in: await prisma.userCard.findMany({
                        where: {
                            card_id: {
                                in: await prisma.card.findMany({
                                    where: { price_tracker_id: { startsWith: 'seed_' } },
                                    select: { id: true }
                                }).then(cards => cards.map(c => c.id))
                            }
                        },
                        select: { id: true }
                    }).then(userCards => userCards.map(uc => uc.id))
                }
            }
        });

        await prisma.userCard.deleteMany({
            where: {
                card_id: {
                    in: await prisma.card.findMany({
                        where: { price_tracker_id: { startsWith: 'seed_' } },
                        select: { id: true }
                    }).then(cards => cards.map(c => c.id))
                }
            }
        });

        await prisma.price_history.deleteMany({
            where: {
                card_id: {
                    in: await prisma.card.findMany({
                        where: { price_tracker_id: { startsWith: 'seed_' } },
                        select: { id: true }
                    }).then(cards => cards.map(c => c.id))
                }
            }
        });

        await prisma.card.deleteMany({
            where: { price_tracker_id: { startsWith: 'seed_' } }
        });

        await prisma.user.deleteMany({
            where: { email: { startsWith: 'collector' } }
        });

        console.log('✅ Cleanup completed');
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        throw error;
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);

    try {
        if (args.includes('--cleanup')) {
            await cleanupSeedData();
        } else {
            await seedDashboardData();
        }
    } catch (error) {
        console.error('❌ Seed operation failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Auto-run when script is executed directly
main();

export { seedDashboardData, cleanupSeedData };