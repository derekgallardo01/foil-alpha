import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
import { Prisma } from '@prisma/client';

// POST /api/transactions - Handle card purchase
export async function POST(request: NextRequest) {
    try {
        // const user = await getCurrentUser(request);
        const user = { id: 1, email: 'admin@test.com', name: 'Admin User' };

        if (!user) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { user_card_id, transaction_type } = body;

        if (!user_card_id || !transaction_type) {
            return NextResponse.json(
                { error: 'user_card_id and transaction_type are required' },
                { status: 400 }
            );
        }

        // Get the card being purchased
        const userCard = await prisma.userCard.findUnique({
            where: { id: user_card_id },
            include: {
                card: true,
                owner: true
            }
        });

        if (!userCard) {
            return NextResponse.json(
                { error: 'Card not found' },
                { status: 404 }
            );
        }

        // Validation checks
        if (userCard.owner_id === user.id) {
            return NextResponse.json(
                { error: 'Cannot purchase your own card' },
                { status: 400 }
            );
        }

        if (!userCard.is_for_sale || userCard.sale_type !== 'FIXED') {
            return NextResponse.json(
                { error: 'Card is not available for fixed price purchase' },
                { status: 400 }
            );
        }

        if (userCard.is_sold) {
            return NextResponse.json(
                { error: 'Card has already been sold' },
                { status: 400 }
            );
        }

        const purchasePrice = Number(userCard.fixed_price);
        if (!purchasePrice || purchasePrice <= 0) {
            return NextResponse.json(
                { error: 'Invalid purchase price' },
                { status: 400 }
            );
        }

        // Perform the transaction
        const result = await prisma.$transaction(async (tx) => {
            // 1. Mark the original card as sold
            await tx.userCard.update({
                where: { id: user_card_id },
                data: {
                    is_sold: true,
                    is_for_sale: false
                }
            });

            // 2. Create a new user card for the buyer
            const newUserCard = await tx.userCard.create({
                data: {
                    card_id: userCard.card_id,
                    owner_id: user.id,
                    condition: userCard.condition,
                    notes: `Purchased from ${userCard.owner.name} for ${purchasePrice}`,
                    is_for_sale: false,
                    is_sold: false
                }
            });

            // 3. Create transaction history for the seller (sale)
            await tx.cardHistory.create({
                data: {
                    user_card_id: user_card_id,
                    from_user_id: userCard.owner_id,
                    to_user_id: user.id,
                    transaction_type: 'SALE',
                    price: purchasePrice,
                    notes: `Sold to ${user.name}`
                }
            });

            // 4. Create transaction history for the buyer (purchase)
            await tx.cardHistory.create({
                data: {
                    user_card_id: newUserCard.id,
                    from_user_id: userCard.owner_id,
                    to_user_id: user.id,
                    transaction_type: 'PURCHASE',
                    price: purchasePrice,
                    notes: `Purchased from ${userCard.owner.name}`
                }
            });

            return {
                transaction: {
                    id: newUserCard.id,
                    buyer: user,
                    seller: userCard.owner,
                    card: userCard.card,
                    price: purchasePrice,
                    transaction_type: 'PURCHASE'
                }
            };
        });

        return NextResponse.json(result, { status: 201 });

    } catch (error) {
        console.error('Error processing transaction:', error);
        return NextResponse.json(
            {
                error: 'Failed to process transaction',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

// GET /api/transactions - Get user's transaction history
export async function GET(request: NextRequest) {
    try {
        // const user = await getCurrentUser(request);
        const user = { id: 1, email: 'admin@test.com', name: 'Admin User' };

        if (!user) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const type = searchParams.get('type'); // 'PURCHASE' or 'SALE'

        const skip = (page - 1) * limit;

        // Build where clause
        const where: Prisma.CardHistoryWhereInput = {
            OR: [
                { from_user_id: user.id }, // User as seller
                { to_user_id: user.id }    // User as buyer
            ]
        };

        if (type) {
            where.transaction_type = type;
        }

        // Get transaction history
        const [transactions, totalCount] = await Promise.all([
            prisma.cardHistory.findMany({
                where,
                skip,
                take: limit,
                orderBy: { created_at: 'desc' },
                include: {
                    userCard: {
                        include: {
                            card: true
                        }
                    },
                    fromUser: {
                        select: { id: true, name: true }
                    },
                    toUser: {
                        select: { id: true, name: true }
                    }
                }
            }),
            prisma.cardHistory.count({ where })
        ]);

        return NextResponse.json({
            transactions,
            pagination: {
                page,
                limit,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit)
            }
        });

    } catch (error) {
        console.error('Error fetching transactions:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch transactions',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}