// scripts/seed.ts - Create this file to add test data
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.create({
        data: {
            email: 'admin@test.com',
            name: 'Admin User',
            password: adminPassword,
            role: 'admin',
            is_verified: 1,
        }
    });

    // Create admin wallet
    await prisma.userWallet.create({
        data: {
            user_id: admin.id,
            balance: 10000.00,
            frozen_balance: 0.00,
        }
    });

    // Create three test users: John, Jane, Bob
    const users = [
        { email: 'john@test.com', name: 'John Smith', balance: 500.00 },
        { email: 'jane@test.com', name: 'Jane Doe', balance: 750.00 },
        { email: 'bob@test.com', name: 'Bob Johnson', balance: 300.00 },
    ];

    const userPassword = await bcrypt.hash('user123', 10);

    for (const userData of users) {
        const user = await prisma.user.create({
            data: {
                email: userData.email,
                name: userData.name,
                password: userPassword,
                role: 'user',
                is_verified: 1,
            }
        });

        // Create wallet for each user
        await prisma.userWallet.create({
            data: {
                user_id: user.id,
                balance: userData.balance,
                frozen_balance: 0.00,
            }
        });

        console.log(`✅ Created user: ${userData.name} (${userData.email})`);
    }

    // Seed Pokemon types
    const pokemonTypes = [
        { name: 'Fire', color: '#FF6666', description: 'Fire-type Pokemon' },
        { name: 'Water', color: '#6666FF', description: 'Water-type Pokemon' },
        { name: 'Grass', color: '#66FF66', description: 'Grass-type Pokemon' },
        { name: 'Electric', color: '#FFFF66', description: 'Electric-type Pokemon' },
        { name: 'Psychic', color: '#FF66FF', description: 'Psychic-type Pokemon' },
        { name: 'Fighting', color: '#CC6666', description: 'Fighting-type Pokemon' },
        { name: 'Normal', color: '#CCCCCC', description: 'Normal-type Pokemon' },
        { name: 'Flying', color: '#99CCFF', description: 'Flying-type Pokemon' },
        { name: 'Poison', color: '#CC66CC', description: 'Poison-type Pokemon' },
        { name: 'Ground', color: '#FFCC66', description: 'Ground-type Pokemon' },
        { name: 'Rock', color: '#996633', description: 'Rock-type Pokemon' },
        { name: 'Bug', color: '#99FF99', description: 'Bug-type Pokemon' },
        { name: 'Ghost', color: '#9999CC', description: 'Ghost-type Pokemon' },
        { name: 'Steel', color: '#CCCCFF', description: 'Steel-type Pokemon' },
        { name: 'Ice', color: '#99FFFF', description: 'Ice-type Pokemon' },
        { name: 'Dragon', color: '#9966FF', description: 'Dragon-type Pokemon' },
        { name: 'Dark', color: '#666666', description: 'Dark-type Pokemon' },
        { name: 'Fairy', color: '#FFB3FF', description: 'Fairy-type Pokemon' },
        { name: 'Colorless', color: '#F0F0F0', description: 'Colorless energy' },
    ];

    for (const typeData of pokemonTypes) {
        await prisma.type.create({
            data: typeData
        });
    }

    // Create a few sample cards (optional)
    const sampleCards = [
        {
            name: 'Charizard',
            set_name: 'Base Set',
            set_number: '4/102',
            rarity: 'Holo Rare',
            card_type: 'Pokemon',
            subtype: 'Stage 2',
            hp: 120,
            image_url: 'https://images.pokemontcg.io/base1/4_hires.png',
            small_image_url: 'https://images.pokemontcg.io/base1/4.png',
            source: 'MANUAL' as const
        },
        {
            name: 'Pikachu',
            set_name: 'Base Set',
            set_number: '58/102',
            rarity: 'Common',
            card_type: 'Pokemon',
            subtype: 'Basic',
            hp: 40,
            image_url: 'https://images.pokemontcg.io/base1/58_hires.png',
            small_image_url: 'https://images.pokemontcg.io/base1/58.png',
            source: 'MANUAL' as const
        }
    ];

    for (const cardData of sampleCards) {
        await prisma.card.create({
            data: cardData
        });
    }

    console.log('🎴 Created sample cards');
    console.log('🌈 Created Pokemon types');
    console.log('✅ Seeding completed!');
    console.log('');
    console.log('👤 Login Credentials:');
    console.log('Admin: admin@test.com / admin123');
    console.log('John:  john@test.com / user123');
    console.log('Jane:  jane@test.com / user123');
    console.log('Bob:   bob@test.com / user123');
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });