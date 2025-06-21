// scripts/seed-sample-data.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const sampleCards = [
    {
        name: "Charizard",
        set_name: "Base Set",
        set_number: "4/102",
        rarity: "Holo Rare",
        card_type: "Pokemon",
        subtype: "Stage 2",
        hp: 120,
        image_url: "https://images.pokemontcg.io/base1/4_hires.png",
        small_image_url: "https://images.pokemontcg.io/base1/4.png"
    },
    {
        name: "Blastoise",
        set_name: "Base Set",
        set_number: "2/102",
        rarity: "Holo Rare",
        card_type: "Pokemon",
        subtype: "Stage 2",
        hp: 100,
        image_url: "https://images.pokemontcg.io/base1/2_hires.png",
        small_image_url: "https://images.pokemontcg.io/base1/2.png"
    },
    {
        name: "Venusaur",
        set_name: "Base Set",
        set_number: "15/102",
        rarity: "Holo Rare",
        card_type: "Pokemon",
        subtype: "Stage 2",
        hp: 100,
        image_url: "https://images.pokemontcg.io/base1/15_hires.png",
        small_image_url: "https://images.pokemontcg.io/base1/15.png"
    },
    {
        name: "Pikachu",
        set_name: "Base Set",
        set_number: "58/102",
        rarity: "Common",
        card_type: "Pokemon",
        subtype: "Basic",
        hp: 40,
        image_url: "https://images.pokemontcg.io/base1/58_hires.png",
        small_image_url: "https://images.pokemontcg.io/base1/58.png"
    },
    {
        name: "Professor Oak",
        set_name: "Base Set",
        set_number: "88/102",
        rarity: "Uncommon",
        card_type: "Trainer",
        subtype: "Supporter",
        hp: null,
        image_url: "https://images.pokemontcg.io/base1/88_hires.png",
        small_image_url: "https://images.pokemontcg.io/base1/88.png"
    }
];

async function seedData() {
    try {
        console.log('🌱 Starting to seed sample data...');

        // Get or create test users
        const adminUser = await prisma.user.findUnique({
            where: { email: 'admin@test.com' }
        });

        const regularUser = await prisma.user.findUnique({
            where: { email: 'user@test.com' }
        });

        if (!adminUser || !regularUser) {
            console.log('❌ Test users not found. Please make sure admin@test.com and user@test.com exist in your database.');
            return;
        }

        console.log('✅ Found test users');

        // Create cards
        console.log('Creating sample cards...');
        const createdCards = [];

        for (const cardData of sampleCards) {
            const existingCard = await prisma.card.findFirst({
                where: {
                    name: cardData.name,
                    set_name: cardData.set_name,
                    set_number: cardData.set_number
                }
            });

            if (!existingCard) {
                const card = await prisma.card.create({
                    data: cardData
                });
                createdCards.push(card);
                console.log(`  ✅ Created card: ${card.name}`);
            } else {
                createdCards.push(existingCard);
                console.log(`  ⚠️  Card already exists: ${existingCard.name}`);
            }
        }

        // Create user cards (collection)
        console.log('Creating user card collections...');

        const userCardData = [
            // Admin user's cards
            {
                card_id: createdCards[0].id, // Charizard
                owner_id: adminUser.id,
                condition: 'NM',
                is_for_sale: true,
                sale_type: 'FIXED',
                fixed_price: 500.00,
                notes: 'Perfect condition Charizard from Base Set'
            },
            {
                card_id: createdCards[1].id, // Blastoise
                owner_id: adminUser.id,
                condition: 'LP',
                is_for_sale: true,
                sale_type: 'AUCTION',
                reserve_price: 100.00,
                auction_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
                notes: 'Light play condition, great for collectors'
            },
            // Regular user's cards
            {
                card_id: createdCards[2].id, // Venusaur
                owner_id: regularUser.id,
                condition: 'NM',
                is_for_sale: true,
                sale_type: 'AUCTION',
                reserve_price: 150.00,
                auction_end: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
                notes: 'Near mint condition, no scratches'
            },
            {
                card_id: createdCards[3].id, // Pikachu
                owner_id: regularUser.id,
                condition: 'MP',
                is_for_sale: true,
                sale_type: 'FIXED',
                fixed_price: 25.00,
                notes: 'Moderately played but iconic card'
            },
            {
                card_id: createdCards[4].id, // Professor Oak
                owner_id: adminUser.id,
                condition: 'NM',
                is_for_sale: false,
                notes: 'Personal collection item'
            }
        ];

        for (const userCardInfo of userCardData) {
            const existingUserCard = await prisma.userCard.findFirst({
                where: {
                    card_id: userCardInfo.card_id,
                    owner_id: userCardInfo.owner_id
                }
            });

            if (!existingUserCard) {
                const userCard = await prisma.userCard.create({
                    data: userCardInfo,
                    include: {
                        card: true,
                        owner: { select: { name: true } }
                    }
                });

                // Create history record
                await prisma.cardHistory.create({
                    data: {
                        user_card_id: userCard.id,
                        to_user_id: userCard.owner_id,
                        transaction_type: 'INITIAL',
                        notes: 'Initial card acquisition'
                    }
                });

                console.log(`  ✅ Created user card: ${userCard.card.name} for ${userCard.owner.name}`);
            } else {
                console.log(`  ⚠️  User card already exists: ${existingUserCard.id}`);
            }
        }

        // Create some sample bids
        console.log('Creating sample bids...');

        const auctionCards = await prisma.userCard.findMany({
            where: {
                sale_type: 'AUCTION',
                is_for_sale: true,
                is_sold: false
            }
        });

        if (auctionCards.length > 0) {
            // Regular user bids on admin's Blastoise
            const blastoise = auctionCards.find(card => card.owner_id === adminUser.id);
            if (blastoise) {
                const existingBid = await prisma.bid.findFirst({
                    where: {
                        user_card_id: blastoise.id,
                        bidder_id: regularUser.id
                    }
                });

                if (!existingBid) {
                    await prisma.bid.create({
                        data: {
                            user_card_id: blastoise.id,
                            bidder_id: regularUser.id,
                            amount: 120.00
                        }
                    });
                    console.log('  ✅ Created sample bid');
                }
            }
        }

        console.log('🎉 Sample data seeded successfully!');
        console.log('\n📊 Summary:');
        console.log(`  Cards created: ${createdCards.length}`);
        console.log(`  User cards created: ${userCardData.length}`);
        console.log('\n🧪 You can now test:');
        console.log('  GET /api/cards - View all cards');
        console.log('  GET /api/user-cards - View user collections');
        console.log('  GET /api/marketplace - Browse cards for sale');
        console.log('  GET /api/bids - View bids');

    } catch (error) {
        console.error('❌ Error seeding data:', error);
    } finally {
        await prisma.$disconnect();
    }
}

seedData();