// src/app/api/user-cards/my-sales/route.ts - Optimized for performance
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '../../../lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = parseInt(session.user.id);

        // OPTIMIZED: Use Promise.all for parallel queries (without problematic includes)
        const [activeSales, soldTransactions] = await Promise.all([
            // Active sales query - without includes
            prisma.userCard.findMany({
                where: {
                    owner_id: userId,
                    is_for_sale: true,
                    is_sold: false
                },
                orderBy: { created_at: 'desc' },
                take: 50 // Limit results
            }),

            // Sold items query - without includes (remove completed_at field)
            prisma.transaction.findMany({
                where: {
                    seller_id: userId,
                    status: 'COMPLETED'
                },
                orderBy: { created_at: 'desc' }, // Use created_at instead of completed_at
                take: 50 // Limit results
            })
        ]);

        // Get related data separately for active sales
        const activeSalesProcessed = await Promise.all(
            activeSales.map(async (sale) => {
                // Get card details
                const card = await prisma.card.findUnique({
                    where: { id: sale.card_id },
                    select: {
                        id: true,
                        name: true,
                        set_name: true,
                        set_number: true,
                        rarity: true,
                        image_url: true,
                        small_image_url: true
                    }
                });

                // Get active bids
                const bids = await prisma.bid.findMany({
                    where: {
                        userCardId: sale.id,
                        is_active: true
                    },
                    take: 10,
                    orderBy: { amount: 'desc' }
                });

                // Get bidder details for each bid
                const bidsWithBidders = await Promise.all(
                    bids.map(async (bid) => {
                        const bidder = await prisma.user.findUnique({
                            where: { id: bid.bidderId },
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        });

                        return {
                            id: bid.id,
                            amount: Number(bid.amount),
                            bidder: bidder,
                            created_at: bid.createdAt,
                            is_active: bid.is_active
                        };
                    })
                );

                const now = new Date();
                const auctionEnd = sale.auction_end ? new Date(sale.auction_end) : null;
                const timeRemaining = auctionEnd ? Math.max(0, auctionEnd.getTime() - now.getTime()) : null;
                const highestBid = bidsWithBidders.length > 0 ? bidsWithBidders[0].amount : null;

                return {
                    id: sale.id,
                    card: card,
                    condition: sale.condition,
                    sale_type: sale.sale_type,
                    fixed_price: sale.fixed_price ? Number(sale.fixed_price) : null,
                    reserve_price: sale.reserve_price ? Number(sale.reserve_price) : null,
                    auction_end: sale.auction_end,
                    bids: bidsWithBidders,
                    highest_bid: highestBid,
                    bid_count: bidsWithBidders.length,
                    time_remaining: timeRemaining,
                    created_at: sale.created_at
                };
            })
        );

        // Get related data separately for sold items
        const soldItemsProcessed = await Promise.all(
            soldTransactions.map(async (transaction) => {
                // Get user card details
                const userCard = await prisma.userCard.findUnique({
                    where: { id: transaction.user_card_id }
                });

                // Get card details
                const card = userCard ? await prisma.card.findUnique({
                    where: { id: userCard.card_id },
                    select: {
                        id: true,
                        name: true,
                        set_name: true,
                        set_number: true,
                        rarity: true,
                        image_url: true,
                        small_image_url: true
                    }
                }) : null;

                // Get buyer details
                const buyer = await prisma.user.findUnique({
                    where: { id: transaction.buyer_id },
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                });

                return {
                    id: transaction.id,
                    card: card,
                    condition: userCard?.condition,
                    sale_type: transaction.transaction_type,
                    sale_price: Number(transaction.amount),
                    buyer: buyer,
                    completed_at: transaction.updated_at, // Use updated_at as completion date
                    created_at: transaction.created_at,
                    notes: transaction.notes
                };
            })
        );

        // Filter out items with missing data
        const validActiveSales = activeSalesProcessed.filter(sale => sale.card !== null);
        const validSoldItems = soldItemsProcessed.filter(item => item.card !== null);

        return NextResponse.json({
            activeSales: validActiveSales,
            soldItems: validSoldItems
        });

    } catch (error) {
        console.error('Error fetching sales data:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch sales data',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}