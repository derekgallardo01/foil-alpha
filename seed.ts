// prisma/seed.ts
import { PrismaClient, CardSource } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database seed...');

    // 1. Create Users
    console.log('👥 Creating users...');

    const hashedAdminPassword = await bcrypt.hash('admin123', 10);
    const hashedUserPassword = await bcrypt.hash('user123', 10);

    // Create admin user
    const admin = await prisma.user.upsert({
        where: { email: 'admin@test.com' },
        update: {},
        create: {
            email: 'admin@test.com',
            name: 'Admin User',
            password: hashedAdminPassword,
            role: 'admin',
            is_verified: 1,
            registeredAt: new Date(),
        },
    });

    // Create regular users
    const bob = await prisma.user.upsert({
        where: { email: 'bob@test.com' },
        update: {},
        create: {
            email: 'bob@test.com',
            name: 'Bob Smith',
            password: hashedUserPassword,
            role: 'user',
            is_verified: 1,
            registeredAt: new Date(),
        },
    });

    const john = await prisma.user.upsert({
        where: { email: 'john@test.com' },
        update: {},
        create: {
            email: 'john@test.com',
            name: 'John Doe',
            password: hashedUserPassword,
            role: 'user',
            is_verified: 1,
            registeredAt: new Date(),
        },
    });

    const charley = await prisma.user.upsert({
        where: { email: 'charley@test.com' },
        update: {},
        create: {
            email: 'charley@test.com',
            name: 'Charley Brown',
            password: hashedUserPassword,
            role: 'user',
            is_verified: 1,
            registeredAt: new Date(),
        },
    });

    console.log(`✅ Created users: ${admin.name}, ${bob.name}, ${john.name}, ${charley.name}`);

    // 2. Create User Wallets
    console.log('💰 Creating user wallets...');

    const wallets = [
        { userId: admin.id, balance: 10000.00 },
        { userId: bob.id, balance: 500.00 },
        { userId: john.id, balance: 750.00 },
        { userId: charley.id, balance: 300.00 },
    ];

    for (const walletData of wallets) {
        await prisma.userWallet.upsert({
            where: { user_id: walletData.userId },
            update: {},
            create: {
                user_id: walletData.userId,
                balance: walletData.balance,
                frozen_balance: 0.00,
            },
        });
    }

    console.log('✅ Created user wallets');

    // 3. Create Card Types (Pokemon Types)
    console.log('🔥 Creating Pokemon card types...');

    const cardTypes = [
        { name: 'Fire', category: 'Pokemon', color: '#FF6666', symbol: '🔥', type_order: 1 },
        { name: 'Water', category: 'Pokemon', color: '#6666FF', symbol: '💧', type_order: 2 },
        { name: 'Grass', category: 'Pokemon', color: '#66FF66', symbol: '🌿', type_order: 3 },
        { name: 'Electric', category: 'Pokemon', color: '#FFFF66', symbol: '⚡', type_order: 4 },
        { name: 'Psychic', category: 'Pokemon', color: '#FF66FF', symbol: '🔮', type_order: 5 },
        { name: 'Ice', category: 'Pokemon', color: '#66FFFF', symbol: '❄️', type_order: 6 },
        { name: 'Dragon', category: 'Pokemon', color: '#9966FF', symbol: '🐉', type_order: 7 },
        { name: 'Dark', category: 'Pokemon', color: '#666666', symbol: '🌑', type_order: 8 },
        { name: 'Fighting', category: 'Pokemon', color: '#CC6666', symbol: '👊', type_order: 9 },
        { name: 'Poison', category: 'Pokemon', color: '#CC66CC', symbol: '☠️', type_order: 10 },
        { name: 'Ground', category: 'Pokemon', color: '#FFCC66', symbol: '🌍', type_order: 11 },
        { name: 'Flying', category: 'Pokemon', color: '#66CCFF', symbol: '🦅', type_order: 12 },
        { name: 'Bug', category: 'Pokemon', color: '#66CC66', symbol: '🐛', type_order: 13 },
        { name: 'Rock', category: 'Pokemon', color: '#CCCC66', symbol: '🗿', type_order: 14 },
        { name: 'Ghost', category: 'Pokemon', color: '#9999CC', symbol: '👻', type_order: 15 },
        { name: 'Steel', category: 'Pokemon', color: '#CCCCCC', symbol: '⚔️', type_order: 16 },
        { name: 'Fairy', category: 'Pokemon', color: '#FFCCFF', symbol: '🧚', type_order: 17 },
        { name: 'Colorless', category: 'Pokemon', color: '#CCCCCC', symbol: '⚪', type_order: 18 },
    ];

    for (const cardType of cardTypes) {
        await prisma.cardType.upsert({
            where: { name: cardType.name },
            update: {},
            create: cardType,
        });
    }

    console.log('✅ Created card types');

    // 4. Create Rarities
    console.log('💎 Creating rarities...');

    const rarities = [
        { name: 'Common', order_index: 1, symbol: '●', color: '#666666' },
        { name: 'Uncommon', order_index: 2, symbol: '◆', color: '#339933' },
        { name: 'Rare', order_index: 3, symbol: '★', color: '#FFD700' },
        { name: 'Holo Rare', order_index: 4, symbol: '☆', color: '#FF6B35' },
        { name: 'Ultra Rare', order_index: 5, symbol: '◇', color: '#8A2BE2' },
        { name: 'Secret Rare', order_index: 6, symbol: '◈', color: '#FF1493' },
        { name: 'Rainbow Rare', order_index: 7, symbol: '🌈', color: '#FF69B4' },
        { name: 'Gold Rare', order_index: 8, symbol: '🏆', color: '#FFD700' },
        { name: 'Promo', order_index: 9, symbol: '⭐', color: '#32CD32' },
    ];

    for (const rarity of rarities) {
        await prisma.rarity.upsert({
            where: { name: rarity.name },
            update: {},
            create: rarity,
        });
    }

    console.log('✅ Created rarities');

    // 5. Create Supertypes
    console.log('🎯 Creating supertypes...');

    const supertypes = [
        { name: 'Pokémon', order_index: 1, description: 'Pokémon characters that battle' },
        { name: 'Trainer', order_index: 2, description: 'Cards that provide effects and support' },
        { name: 'Energy', order_index: 3, description: 'Energy cards required to use attacks' },
    ];

    for (const supertype of supertypes) {
        await prisma.supertype.upsert({
            where: { name: supertype.name },
            update: {},
            create: supertype,
        });
    }

    console.log('✅ Created supertypes');

    // 6. Create Subtypes
    console.log('🏷️ Creating subtypes...');

    const subtypes = [
        // Pokemon subtypes
        { name: 'Basic', category: 'Pokemon', description: 'Basic Pokémon that can be played directly' },
        { name: 'Stage 1', category: 'Pokemon', description: 'Evolved from Basic Pokémon' },
        { name: 'Stage 2', category: 'Pokemon', description: 'Evolved from Stage 1 Pokémon' },
        { name: 'GX', category: 'Pokemon', description: 'Powerful Pokémon with GX attacks' },
        { name: 'EX', category: 'Pokemon', description: 'Powerful Pokémon with high HP' },
        { name: 'V', category: 'Pokemon', description: 'Pokémon V cards with special abilities' },
        { name: 'VMAX', category: 'Pokemon', description: 'Evolved form of Pokémon V' },
        { name: 'VSTAR', category: 'Pokemon', description: 'Evolved form of Pokémon V with VSTAR Power' },
        { name: 'ex', category: 'Pokemon', description: 'Modern ex Pokémon cards' },
        { name: 'Mega', category: 'Pokemon', description: 'Mega Evolution Pokémon' },
        { name: 'Break', category: 'Pokemon', description: 'BREAK Evolution Pokémon' },
        { name: 'Tag Team', category: 'Pokemon', description: 'Two Pokémon working together' },
        { name: 'Fusion Strike', category: 'Pokemon', description: 'Fusion Strike Pokémon' },
        { name: 'Single Strike', category: 'Pokemon', description: 'Single Strike Pokémon' },
        { name: 'Rapid Strike', category: 'Pokemon', description: 'Rapid Strike Pokémon' },

        // Trainer subtypes
        { name: 'Supporter', category: 'Trainer', description: 'One per turn trainer cards' },
        { name: 'Item', category: 'Trainer', description: 'Trainer cards with immediate effects' },
        { name: 'Stadium', category: 'Trainer', description: 'Field effects that stay in play' },
        { name: 'Tool', category: 'Trainer', description: 'Attached to Pokémon for ongoing effects' },
        { name: 'TM', category: 'Trainer', description: 'Technical Machine cards' },

        // Energy subtypes
        { name: 'Basic', category: 'Energy', description: 'Basic Energy cards' },
        { name: 'Special', category: 'Energy', description: 'Special Energy with additional effects' },
        { name: 'Unit', category: 'Energy', description: 'Unit Energy providing multiple types' },
    ];

    for (const subtype of subtypes) {
        await prisma.subtype.upsert({
            where: { name: subtype.name },
            update: {},
            create: subtype,
        });
    }

    console.log('✅ Created subtypes');

    // 7. Create Sample Pokemon Sets
    console.log('📦 Creating sample Pokemon sets...');

    const pokemonSets = [
        {
            id: 'base1',
            name: 'Base Set',
            series: 'Base',
            printed_total: 102,
            total: 102,
            release_date: '1999-01-09',
            ptcgo_code: 'BAS',
        },
        {
            id: 'jungle',
            name: 'Jungle',
            series: 'Base',
            printed_total: 64,
            total: 64,
            release_date: '1999-06-16',
            ptcgo_code: 'JUN',
        },
        {
            id: 'fossil',
            name: 'Fossil',
            series: 'Base',
            printed_total: 62,
            total: 62,
            release_date: '1999-10-10',
            ptcgo_code: 'FOS',
        },
        {
            id: 'swsh1',
            name: 'Sword & Shield',
            series: 'Sword & Shield',
            printed_total: 202,
            total: 216,
            release_date: '2020-02-07',
            ptcgo_code: 'SSH',
        },
    ];

    for (const set of pokemonSets) {
        await prisma.pokemonSet.upsert({
            where: { id: set.id },
            update: {},
            create: set,
        });
    }

    console.log('✅ Created Pokemon sets');

    // 8. Create Sample Cards
    console.log('🃏 Creating sample cards...');

    // Get references for foreign keys
    const baseSet = await prisma.pokemonSet.findUnique({ where: { id: 'base1' } });
    const commonRarity = await prisma.rarity.findUnique({ where: { name: 'Common' } });
    const rareRarity = await prisma.rarity.findUnique({ where: { name: 'Rare' } });
    const holoRarity = await prisma.rarity.findUnique({ where: { name: 'Holo Rare' } });
    const pokemonSupertype = await prisma.supertype.findUnique({ where: { name: 'Pokémon' } });
    const basicSubtype = await prisma.subtype.findUnique({ where: { name: 'Basic' } });
    const fireType = await prisma.cardType.findUnique({ where: { name: 'Fire' } });
    const waterType = await prisma.cardType.findUnique({ where: { name: 'Water' } });
    const electricType = await prisma.cardType.findUnique({ where: { name: 'Electric' } });

    const sampleCards = [
        {
            name: 'Charizard',
            set_name: 'Base Set',
            set_number: '4',
            rarity: 'Holo Rare',
            card_type: 'Pokemon',
            subtype: 'Stage 2',
            hp: 120,
            image_url: 'https://images.pokemontcg.io/base1/4_hires.png',
            small_image_url: 'https://images.pokemontcg.io/base1/4.png',
            set_id: baseSet?.id || null,
            rarity_id: holoRarity?.id || null,
            supertype_id: pokemonSupertype?.id || null,
            subtype_id: basicSubtype?.id || null,
            primary_type_id: fireType?.id || null,
            market_price: 350.00,
            source: CardSource.MANUAL,
        },
        {
            name: 'Blastoise',
            set_name: 'Base Set',
            set_number: '2',
            rarity: 'Holo Rare',
            card_type: 'Pokemon',
            subtype: 'Stage 2',
            hp: 100,
            image_url: 'https://images.pokemontcg.io/base1/2_hires.png',
            small_image_url: 'https://images.pokemontcg.io/base1/2.png',
            set_id: baseSet?.id || null,
            rarity_id: holoRarity?.id || null,
            supertype_id: pokemonSupertype?.id || null,
            subtype_id: basicSubtype?.id || null,
            primary_type_id: waterType?.id || null,
            market_price: 280.00,
            source: CardSource.MANUAL,
        },
        {
            name: 'Pikachu',
            set_name: 'Base Set',
            set_number: '58',
            rarity: 'Common',
            card_type: 'Pokemon',
            subtype: 'Basic',
            hp: 40,
            image_url: 'https://images.pokemontcg.io/base1/58_hires.png',
            small_image_url: 'https://images.pokemontcg.io/base1/58.png',
            set_id: baseSet?.id || null,
            rarity_id: commonRarity?.id || null,
            supertype_id: pokemonSupertype?.id || null,
            subtype_id: basicSubtype?.id || null,
            primary_type_id: electricType?.id || null,
            market_price: 25.00,
            source: CardSource.MANUAL,
        },
    ];

    for (const cardData of sampleCards) {
        await prisma.card.create({
            data: cardData,
        });
    }

    console.log('✅ Created sample cards');

    console.log('🎉 Database seed completed successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log('   👤 Admin: admin@test.com / admin123');
    console.log('   👥 Users: bob@test.com, john@test.com, charley@test.com / user123');
    console.log('   🎯 Card Types: 18 Pokemon types');
    console.log('   💎 Rarities: 9 different rarities');
    console.log('   🏷️ Subtypes: 25 card subtypes');
    console.log('   📦 Sets: 4 Pokemon sets');
    console.log('   🃏 Cards: 3 sample cards');
    console.log('   💰 All users have wallets with starting balances');
    console.log('');
    console.log('🚀 Ready to test Pokemon card imports!');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });