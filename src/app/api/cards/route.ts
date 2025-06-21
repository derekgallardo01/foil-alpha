// src/app/api/cards/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

// GET /api/cards - Get all cards with pagination
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const search = searchParams.get('search') || '';
        const setName = searchParams.get('set') || '';
        const cardType = searchParams.get('type') || '';

        const skip = (page - 1) * limit;

        // Build where clause for filtering
        const where: any = {};

        if (search) {
            where.name = {
                contains: search,
                mode: 'insensitive'
            };
        }

        if (setName) {          
            where.set_name = setName;
        }

        if (cardType) {
            where.card_type = cardType;
        }

        // Get cards with pagination
        const [cards, totalCount] = await Promise.all([
            prisma.card.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    name: 'asc'
                },
                include: {
                    userCards: {
                        where: {
                            is_for_sale: true,
                            is_sold: false
                        },
                        select: {
                            id: true,
                            condition: true,
                            sale_type: true,
                            fixed_price: true,
                            reserve_price: true,
                            auction_end: true,
                            owner: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    }
                }
            }),
            prisma.card.count({ where })
        ]);

        return NextResponse.json({
            cards,
            pagination: {
                page,
                limit,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit)
            }
        });

    } catch (error) {
        console.error('Error fetching cards:', error);
        return NextResponse.json(
            { error: 'Failed to fetch cards' },
            { status: 500 }
        );
    }
}

// POST /api/cards - Create a new card (admin only for now)
export async function POST(request: NextRequest) {
    try {
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
                hp,
                image_url,
                small_image_url,
                tcg_id
            }
        });

        return NextResponse.json(newCard, { status: 201 });

    } catch (error) {
        console.error('Error creating card:', error);
        return NextResponse.json(
            { error: 'Failed to create card' },
            { status: 500 }
        );
    }
}