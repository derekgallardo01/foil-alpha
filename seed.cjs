// fresh-seed.js - Clean seed script for fresh database
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting fresh seed on clean database...');

  try {
    // 1. Create Users
    console.log('👥 Creating users...');

    const admin = await prisma.user.create({
      data: {
        email: 'admin@test.com',
        name: 'Admin User',
        password: await bcrypt.hash('123', 10),
        role: 'admin',
        subscriptionStatus: 'active',
        is_verified: 1,
      },
    });

    const user1 = await prisma.user.create({
      data: {
        email: 'collector1@test.com',
        name: 'Pokemon Collector 1',
        password: await bcrypt.hash('user123', 10),
        role: 'user',
        is_verified: 1,
      },
    });

    const user2 = await prisma.user.create({
      data: {
        email: 'collector2@test.com',
        name: 'Pokemon Collector 2',
        password: await bcrypt.hash('user123', 10),
        role: 'user',
        is_verified: 1,
      },
    });

    const user3 = await prisma.user.create({
      data: {
        email: 'trader@test.com',
        name: 'Card Trader',
        password: await bcrypt.hash('user123', 10),
        role: 'user',
        is_verified: 1,
      },
    });

    console.log('✅ Created 4 users');

    // 2. Create User Wallets
    console.log('💰 Creating user wallets...');

    await prisma.userWallet.create({
      data: {
        user_id: admin.id,
        balance: 10000.00,
        frozen_balance: 0.00,
      },
    });

    await prisma.userWallet.create({
      data: {
        user_id: user1.id,
        balance: 500.00,
        frozen_balance: 0.00,
      },
    });

    await prisma.userWallet.create({
      data: {
        user_id: user2.id,
        balance: 750.00,
        frozen_balance: 50.00,
      },
    });

    await prisma.userWallet.create({
      data: {
        user_id: user3.id,
        balance: 1200.00,
        frozen_balance: 100.00,
      },
    });

    console.log('✅ Created user wallets');

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
      },
    });

    console.log('✅ Created Pokemon sets');

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

    const uncommonRarity = await prisma.rarity.create({
      data: {
        name: 'Uncommon',
        symbol: '◆',
        order_index: 2,
        color: '#C0C0C0',
        description: 'Uncommon cards',
      },
    });

    const rareRarity = await prisma.rarity.create({
      data: {
        name: 'Rare',
        symbol: '★',
        order_index: 3,
        color: '#FFD700',
        description: 'Rare cards',
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

    console.log('✅ Created rarities');

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

    console.log('✅ Created supertypes');

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

    console.log('✅ Created subtypes');

    // 7. Create Cards
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
        source: 'API',
        sync_enabled: true,
        last_price_update: new Date(),
        artist: 'Mitsuhiro Arita',
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
        source: 'API',
        sync_enabled: true,
        last_price_update: new Date(),
        artist: 'Ken Sugimori',
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
        source: 'API',
        sync_enabled: true,
        last_price_update: new Date(),
        artist: 'Ken Sugimori',
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
        source: 'API',
        sync_enabled: true,
        last_price_update: new Date(),
        artist: 'Atsuko Nishida',
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
        rarity_id: uncommonRarity.id,
        supertype_id: trainerSupertype.id,
        subtype_id: supporterSubtype.id,
        api_id: 'base1-88',
        market_price: 15.00,
        price_trend: 'down',
        source: 'API',
        sync_enabled: true,
        last_price_update: new Date(),
        artist: 'Ken Sugimori',
      },
    });

    const cards = [charizard, blastoise, venusaur, pikachu, professorOak];
    console.log(`✅ Created ${cards.length} cards`);

    // 8. Create Price History (30 days for each card)
    console.log('📈 Creating price history...');

    const now = new Date();
    let priceHistoryCount = 0;

    for (const card of cards) {
      for (let i = 30; i >= 0; i--) {
        const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
        const basePrice = Number(card.market_price);
        const variation = (Math.random() - 0.5) * 0.2; // ±10% variation
        const price = basePrice * (1 + variation);

        await prisma.price_history.create({
          data: {
            card_id: card.id,
            price: Math.max(0.25, price),
            source: 'pokemon_price_tracker',
            recorded_at: date,
            metadata: {
              price_change_24h: (Math.random() - 0.5) * 10,
              volume_24h: Math.floor(Math.random() * 100) + 10,
              is_seed_data: true,
            },
          },
        });
        priceHistoryCount++;
      }
    }

    console.log(`✅ Created ${priceHistoryCount} price history entries`);

    // 9. Create User Cards (Collections)
    console.log('🎴 Creating user cards...');

    const userCard1 = await prisma.userCard.create({
      data: {
        owner_id: user1.id,
        card_id: charizard.id,
        condition: 'Near Mint',
        is_for_sale: true,
        sale_type: 'FIXED',
        fixed_price: 380.00,
        notes: 'Perfect condition, just graded',
      },
    });

    const userCard2 = await prisma.userCard.create({
      data: {
        owner_id: user1.id,
        card_id: pikachu.id,
        condition: 'Mint',
        is_for_sale: false,
        notes: 'Personal collection',
      },
    });

    const userCard3 = await prisma.userCard.create({
      data: {
        owner_id: user2.id,
        card_id: blastoise.id,
        condition: 'Light Play',
        is_for_sale: true,
        sale_type: 'AUCTION',
        reserve_price: 250.00,
        auction_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        notes: 'Slight edge wear but still beautiful',
      },
    });

    const userCard4 = await prisma.userCard.create({
      data: {
        owner_id: user3.id,
        card_id: venusaur.id,
        condition: 'Mint',
        is_for_sale: true,
        sale_type: 'FIXED',
        fixed_price: 240.00,
        notes: 'Completed the base set trio!',
      },
    });

    console.log('✅ Created user cards');

    // 10. Create Bids
    console.log('💰 Creating bids...');

    await prisma.bid.create({
      data: {
        userCardId: userCard3.id,
        bidderId: user1.id,
        amount: 260.00,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.bid.create({
      data: {
        userCardId: userCard3.id,
        bidderId: user3.id,
        amount: 280.00,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    });

    console.log('✅ Created bids');

    // 11. Create Activity Logs
    console.log('📊 Creating activity logs...');

    await prisma.activityLog.create({
      data: {
        userId: admin.id,
        action: 'price_sync_completed',
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: user1.id,
        action: 'card_listed_for_sale',
      },
    });

    console.log('✅ Created activity logs');

    console.log('\n🎉 Fresh seed completed successfully!');

    // Print summary
    console.log('\n📋 FRESH DATABASE SUMMARY:');
    console.log('==========================');
    console.log('👑 Admin: admin@test.com (password: 123)');
    console.log('👥 Users:');
    console.log('   • collector1@test.com (password: user123) - Owns Charizard (for sale), Pikachu');
    console.log('   • collector2@test.com (password: user123) - Owns Blastoise (auction)');
    console.log('   • trader@test.com (password: user123) - Owns Venusaur (for sale)');
    console.log(`🃏 Cards: ${cards.length} (Charizard, Blastoise, Venusaur, Pikachu, Professor Oak)`);
    console.log(`📈 Price History: ${priceHistoryCount} entries (31 days per card)`);
    console.log('🎴 User Collections: 4 cards (3 for sale, 1 auction)');
    console.log('💰 Active Bids: 2 bids on Blastoise auction');
    console.log('💳 User Wallets: All users have balances');
    console.log('\n🚀 Ready to test:');
    console.log('   • Login as admin and test /admin/pricing/update');
    console.log('   • Login as users to see collections');
    console.log('   • View price charts with 31 days of data');
    console.log('   • Test marketplace and bidding');
    console.log('   • Run price sync operations');

  } catch (error) {
    console.error('❌ Fresh seed failed:', error);
    console.error('Error details:', error.message);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed process failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });