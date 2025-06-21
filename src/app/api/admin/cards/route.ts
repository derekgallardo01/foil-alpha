// src/app/api/admin/cards/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
// import { getCurrentUser } from '../../../lib/dev-auth';

// GET /api/admin/cards - Get all cards with admin info
export async function GET(request: NextRequest) {
    try {
        // const user = await getCurrentUser(request);
        const user = { id: 1, email: 'admin@test.com', name: 'Admin User', role: 'admin' }


        if (!user || user.role !== 'admin') {
            return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const search = searchParams.get('search') || '';
        const setName = searchParams.get('set') || '';
        const cardType = searchParams.get('type') || '';

        const skip = (page - 1) * limit;

        // Build where clause
        const where: any = {};

        if (search) {
            where.name = {
                contains: search
            };
        }

        if (setName) {
            where.set_name = setName;
        }

        if (cardType) {
            where.card_type = cardType;
        }

        // Get cards with user card counts
        const [cards, totalCount] = await Promise.all([
            prisma.card.findMany({
                where,
                skip,
                take: limit,
                orderBy: { created_at: 'desc' },
                include: {
                    userCards: {
                        select: {
                            id: true,
                            owner_id: true,
                            is_for_sale: true,
                            is_sold: true,
                            condition: true
                        }
                    },
                    _count: {
                        select: {
                            userCards: true
                        }
                    }
                }
            }),
            prisma.card.count({ where })
        ]);

        // Add computed fields
        const cardsWithStats = cards.map(card => ({
            ...card,
            totalOwned: card._count.userCards,
            forSaleCount: card.userCards.filter(uc => uc.is_for_sale && !uc.is_sold).length,
            soldCount: card.userCards.filter(uc => uc.is_sold).length,
            uniqueOwners: new Set(card.userCards.map(uc => uc.owner_id)).size
        }));

        return NextResponse.json({
            cards: cardsWithStats,
            pagination: {
                page,
                limit,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit)
            }
        });

    } catch (error) {
        console.error('Error fetching admin cards:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch cards',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

// POST /api/admin/cards - Create new card
export async function POST(request: NextRequest) {
    try {
        // const user = await getCurrentUser(request);
        const user = { id: 1, email: 'admin@test.com', name: 'Admin User', role: 'admin' }


        if (!user || user.role !== 'admin') {
            return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const {
            name,
            set_name,
            set_number,
            rarity,
            card_type,
            subtype,
            hp,
            image_url,
            small_image_url,
            tcg_id
        } = body;

        // Validate required fields
        if (!name || !set_name || !set_number || !rarity || !card_type) {
            return NextResponse.json(
                { error: 'Missing required fields: name, set_name, set_number, rarity, card_type' },
                { status: 400 }
            );
        }

        // Check if card already exists
        const existingCard = await prisma.card.findFirst({
            where: {
                name,
                set_name,
                set_number
            }
        });

        if (existingCard) {
            return NextResponse.json(
                { error: 'Card already exists with this name, set, and number' },
                { status: 409 }
            );
        }

        // Create new card
        const newCard = await prisma.card.create({
            data: {
                name,
                set_name,
                set_number,
                rarity,
                card_type,
                subtype,
                hp: hp ? parseInt(hp) : null,
                image_url,
                small_image_url,
                tcg_id
            },
            include: {
                _count: {
                    select: {
                        userCards: true
                    }
                }
            }
        });

        return NextResponse.json({
            ...newCard,
            totalOwned: 0,
            forSaleCount: 0,
            soldCount: 0,
            uniqueOwners: 0
        }, { status: 201 });

    } catch (error) {
        console.error('Error creating card:', error);
        return NextResponse.json(
            {
                error: 'Failed to create card',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

// POST /api/admin/cards/bulk - Bulk create cards
export async function PUT(request: NextRequest) {
    try {
        // const user = await getCurrentUser(request);
        const user = { id: 1, email: 'admin@test.com', name: 'Admin User', role: 'admin' }


        if (!user || user.role !== 'admin') {
            return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { cards } = body;

        if (!Array.isArray(cards) || cards.length === 0) {
            return NextResponse.json(
                { error: 'Cards array is required and must not be empty' },
                { status: 400 }
            );
        }

        const results: {
            created: any[];
            skipped: any[];
            errors: any[];
        } = {
            created: [],
            skipped: [],
            errors: []
        };

        // Process each card
        for (const cardData of cards) {
            try {
                const {
                    name,
                    set_name,
                    set_number,
                    rarity,
                    card_type,
                    subtype,
                    hp,
                    image_url,
                    small_image_url,
                    tcg_id
                } = cardData;

                // Validate required fields
                if (!name || !set_name || !set_number || !rarity || !card_type) {
                    results.errors.push({
                        card: cardData,
                        error: 'Missing required fields'
                    });
                    continue;
                }

                // Check if card already exists
                const existingCard = await prisma.card.findFirst({
                    where: {
                        name,
                        set_name,
                        set_number
                    }
                });

                if (existingCard) {
                    results.skipped.push({
                        card: cardData,
                        reason: 'Card already exists'
                    });
                    continue;
                }

                // Create card
                const newCard = await prisma.card.create({
                    data: {
                        name,
                        set_name,
                        set_number,
                        rarity,
                        card_type,
                        subtype,
                        hp: hp ? parseInt(hp) : null,
                        image_url,
                        small_image_url,
                        tcg_id
                    }
                });

                results.created.push(newCard);

            } catch (error) {
                results.errors.push({
                    card: cardData,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        return NextResponse.json(results, { status: 201 });

    } catch (error) {
        console.error('Error bulk creating cards:', error);
        return NextResponse.json(
            {
                error: 'Failed to bulk create cards',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}