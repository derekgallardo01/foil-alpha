// src/app/api/user-cards/my-sales/route.ts - User's selling history and active sales
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '../../../lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user
        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { searchParams } = new URL(request.url);
        const includeActive = searchParams.get('include_active') !== 'false';
        const includeSold = searchParams.get('include_sold') !== 'false';

        // Build where clause for active sales
        const activeSalesWhere: any = {
            owner_id: user.id,
            is_for_sale: true,
            is_sold: false
        };

        // Build where clause for sold items
        const soldItemsWhere: any = {
            seller_id: user.id,
            status: 'COMPLETED'
        };

        const results: any = {};

        if (includeActive) {
            // Get active sales (both fixed price and auctions)
            const activeSales = await prisma.userCard.findMany({
                where: activeSalesWhere,
                include: {
                    card: true,
                    bids: {
                        where: { is_active: true },
                        orderBy: { amount: 'desc' },
                        include: {
                            bidder: {
                                select: { id: true, name: true, email: true }
                            }
                        }
                    }
                },
                orderBy: { created_at: 'desc' }
            });

            // Format active sales with bid information
            results.activeSales = activeSales.map(userCard => {
                const highestBid = userCard.bids.length > 0 ? Number(userCard.bids[0].amount) : null;
                const timeRemaining = userCard.auction_end ?
                    Math.max(0, new Date(userCard.auction_end).getTime() - Date.now()) : null;

                return {
                    id: userCard.id,
                    card: userCard.card,
                    condition: userCard.condition,
                    sale_type: userCard.sale_type,
                    fixed_price: userCard.fixed_price ? Number(userCard.fixed_price) : null,
                    reserve_price: userCard.reserve_price ? Number(userCard.reserve_price) : null,
                    auction_end: userCard.auction_end,
                    bids: userCard.bids.map(bid => ({
                        id: bid.id,
                        amount: Number(bid.amount),
                        bidder: bid.bidder,
                        created_at: bid.created_at,
                        is_active: bid.is_active
                    })),
                    highest_bid: highestBid,
                    bid_count: userCard.bids.length,
                    time_remaining: timeRemaining,
                    created_at: userCard.created_at
                };
            });
        }

        if (includeSold) {
            // Get completed transactions (sold items)
            const soldTransactions = await prisma.transaction.findMany({
                where: soldItemsWhere,
                include: {
                    userCard: {
                        include: {
                            card: true
                        }
                    },
                    buyer: {
                        select: { id: true, name: true, email: true }
                    }
                },
                orderBy: { completed_at: 'desc' }
            });

            results.soldItems = soldTransactions.map(transaction => ({
                id: transaction.id,
                card: transaction.userCard.card,
                condition: transaction.userCard.condition,
                sale_type: transaction.transaction_type,
                sale_price: Number(transaction.amount),
                buyer: transaction.buyer,
                completed_at: transaction.completed_at,
                created_at: transaction.created_at,
                notes: transaction.notes
            }));
        }

        return NextResponse.json(results);

    } catch (error) {
        console.error('Error fetching user sales:', error);
        return NextResponse.json(
            { error: 'Failed to fetch user sales' },
            { status: 500 }
        );
    }
}