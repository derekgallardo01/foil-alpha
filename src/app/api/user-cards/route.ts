// src/app/api/user-cards/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '../../lib/prisma';

// GET /api/user-cards - Get user's card collection
export async function GET(request: NextRequest) {
    console.log('🔍 User-cards API called');
    try {

        // const user = { id: 1, email: 'admin@test.com', name: 'Admin User' }; //temp
        const session = await getServerSession();

        if (!session?.user?.email) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        // Get user
        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const forSale = searchParams.get('forSale') === 'true';

        const skip = (page - 1) * limit;

        // Build where clause
        const where: any = {
            owner_id: user.id
        };

        if (forSale) {
            where.is_for_sale = true;
            where.is_sold = false;
        }

        // Get user's cards
        const [userCards, totalCount] = await Promise.all([
            prisma.userCard.findMany({
                where,
                skip,
                take: limit,
                include: {
                    card: true,
                    bids: {
                        where: { is_active: true },
                        orderBy: { amount: 'desc' },
                        include: {
                            bidder: {
                                select: { id: true, name: true }
                            }
                        }
                    }
                },
                orderBy: { acquired_date: 'desc' }
            }),
            prisma.userCard.count({ where })
        ]);

        return NextResponse.json({
            userCards,
            pagination: {
                page,
                limit,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit)
            }
        });

    } catch (error) {
        console.error('Error fetching user cards:', error);
        return NextResponse.json(
            { error: 'Failed to fetch user cards' },
            { status: 500 }
        );
    }
}

// POST /api/user-cards - Add card to user's collection (purchase)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession();

        if (!session?.user?.email) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        // Get user
        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        const body = await request.json();
        const { card_id, condition = 'NM', notes, purchase_price } = body;

        if (!card_id) {
            return NextResponse.json(
                { error: 'card_id is required' },
                { status: 400 }
            );
        }

        // Verify card exists
        const card = await prisma.card.findUnique({
            where: { id: card_id }
        });

        if (!card) {
            return NextResponse.json(
                { error: 'Card not found' },
                { status: 404 }
            );
        }

        // Create user card and history record in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // Create user card
            const userCard = await tx.userCard.create({
                data: {
                    card_id,
                    owner_id: user.id,
                    condition,
                    notes
                },
                include: {
                    card: true
                }
            });

            // Create history record
            await tx.cardHistory.create({
                data: {
                    user_card_id: userCard.id,
                    to_user_id: user.id,
                    transaction_type: 'PURCHASE',
                    price: purchase_price ? parseFloat(purchase_price) : null,
                    notes: `Initial purchase - ${condition} condition`
                }
            });

            return userCard;
        });

        return NextResponse.json(result, { status: 201 });

    } catch (error) {
        console.error('Error adding card to collection:', error);
        return NextResponse.json(
            { error: 'Failed to add card to collection' },
            { status: 500 }
        );
    }
}