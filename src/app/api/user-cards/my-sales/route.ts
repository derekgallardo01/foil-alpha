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

        // OPTIMIZED: Use Promise.all for parallel queries
        const [activeSales, soldItems] = await Promise.all([
            // Active sales query - optimized with select
            prisma.userCard.findMany({
                where: {
                    owner_id: userId,
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
                    created_at: true,
                    card: {
                        select: {
                            id: true,
                            name: true,
                            set_name: true,
                            set_number: true,
                            rarity: true,
                            image_url: true,
                            small_image_url: true
                        }
                    },
                    // OPTIMIZED: Only get active bids, limit to 10 most recent
                    bids: {
                        where: { is_active: true },
                        take: 10,
                        orderBy: { amount: 'desc' },
                        select: {
                            id: true,
                            amount: true,
                            created_at: true,
                            is_active: true,
                            bidder: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true
                                }
                            }
                        }
                    }
                },
                orderBy: { created_at: 'desc' },
                take: 50 // Limit results
            }),

            // Sold items query - optimized with select
            prisma.transaction.findMany({
                where: {
                    seller_id: userId,
                    status: 'COMPLETED'
                },
                select: {
                    id: true,
                    amount: true,
                    transaction_type: true,
                    completed_at: true,
                    created_at: true,
                    notes: true,
                    userCard: {
                        select: {
                            id: true,
                            condition: true,
                            card: {
                                select: {
                                    id: true,
                                    name: true,
                                    set_name: true,
                                    set_number: true,
                                    rarity: true,
                                    image_url: true,
                                    small_image_url: true
                                }
                            }
                        }
                    },
                    buyer: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                },
                orderBy: { completed_at: 'desc' },
                take: 50 // Limit results
            })
        ]);

        // OPTIMIZED: Process data efficiently
        const activeSalesProcessed = activeSales.map(sale => {
            const now = new Date();
            const auctionEnd = sale.auction_end ? new Date(sale.auction_end) : null;
            const timeRemaining = auctionEnd ? Math.max(0, auctionEnd.getTime() - now.getTime()) : null;
            const highestBid = sale.bids.length > 0 ? Number(sale.bids[0].amount) : null;

            return {
                id: sale.id,
                card: sale.card,
                condition: sale.condition,
                sale_type: sale.sale_type,
                fixed_price: sale.fixed_price ? Number(sale.fixed_price) : null,
                reserve_price: sale.reserve_price ? Number(sale.reserve_price) : null,
                auction_end: sale.auction_end,
                bids: sale.bids.map(bid => ({
                    id: bid.id,
                    amount: Number(bid.amount),
                    bidder: bid.bidder,
                    created_at: bid.created_at,
                    is_active: bid.is_active
                })),
                highest_bid: highestBid,
                bid_count: sale.bids.length,
                time_remaining: timeRemaining,
                created_at: sale.created_at
            };
        });

        const soldItemsProcessed = soldItems.map(item => ({
            id: item.id,
            card: item.userCard.card,
            condition: item.userCard.condition,
            sale_type: item.transaction_type,
            sale_price: Number(item.amount),
            buyer: item.buyer,
            completed_at: item.completed_at,
            created_at: item.created_at,
            notes: item.notes
        }));

        return NextResponse.json({
            activeSales: activeSalesProcessed,
            soldItems: soldItemsProcessed
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