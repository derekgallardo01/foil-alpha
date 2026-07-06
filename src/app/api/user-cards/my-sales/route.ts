// src/app/api/user-cards/my-sales/route.ts - FIXED for updated schema
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const auth = await requireUser();
        if ("response" in auth) return auth.response;
        const user = auth.user;

        const userId = user.id;

        console.log(`Fetching sales data for user ${userId}`);

        // FIXED: Use correct field names from schema
        const [activeSales, soldTransactions] = await Promise.all([
            // Active sales query
            prisma.userCard.findMany({
                where: {
                    owner_id: userId,
                    is_for_sale: true,
                    is_sold: false
                },
                orderBy: { created_at: 'desc' },
                take: 50
            }),

            // Sold items query  
            prisma.transaction.findMany({
                where: {
                    seller_id: userId,
                    status: 'COMPLETED'
                },
                orderBy: { created_at: 'desc' },
                take: 50
            })
        ]);

        console.log(`Found ${activeSales.length} active sales and ${soldTransactions.length} sold transactions`);

        // Process active sales with related data
        const activeSalesProcessed = await Promise.all(
            activeSales.map(async (sale) => {
                try {
                    // Get card details - FIXED: Use correct field names
                    const card = await prisma.card.findUnique({
                        where: { id: sale.card_id },
                        select: {
                            id: true,
                            name: true,
                            set_name: true,
                            card_number: true, // FIXED: Use card_number instead of set_number
                            rarity: true,
                            image_url: true
                        }
                    });

                    if (!card) {
                        console.warn(`Card not found for sale ${sale.id}`);
                        return null;
                    }

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
                                bidder: bidder || { id: 0, name: 'Unknown', email: '' },
                                created_at: bid.createdAt.toISOString(),
                                is_active: bid.is_active
                            };
                        })
                    );

                    // Calculate time remaining for auctions
                    const now = new Date();
                    const auctionEnd = sale.auction_end ? new Date(sale.auction_end) : null;
                    const timeRemaining = auctionEnd ? Math.max(0, auctionEnd.getTime() - now.getTime()) : null;
                    const highestBid = bidsWithBidders.length > 0 ? bidsWithBidders[0].amount : null;

                    return {
                        id: sale.id,
                        card: {
                            id: card.id,
                            name: card.name,
                            set_name: card.set_name,
                            set_number: card.card_number, // FIXED: Map card_number to set_number for frontend
                            rarity: card.rarity,
                            image_url: card.image_url,
                            small_image_url: card.image_url // Use same image for both
                        },
                        condition: sale.condition || 'Unknown',
                        sale_type: sale.sale_type || 'FIXED',
                        fixed_price: sale.fixed_price ? Number(sale.fixed_price) : null,
                        reserve_price: sale.reserve_price ? Number(sale.reserve_price) : null,
                        auction_end: sale.auction_end?.toISOString() || null,
                        bids: bidsWithBidders,
                        highest_bid: highestBid,
                        bid_count: bidsWithBidders.length,
                        time_remaining: timeRemaining,
                        created_at: sale.created_at.toISOString()
                    };
                } catch (error) {
                    console.error(`Error processing active sale ${sale.id}:`, error);
                    return null;
                }
            })
        );

        // Process sold items with related data
        const soldItemsProcessed = await Promise.all(
            soldTransactions.map(async (transaction) => {
                try {
                    // Get user card details
                    const userCard = await prisma.userCard.findUnique({
                        where: { id: transaction.user_card_id }
                    });

                    if (!userCard) {
                        console.warn(`UserCard not found for transaction ${transaction.id}`);
                        return null;
                    }

                    // Get card details - FIXED: Use correct field names
                    const card = await prisma.card.findUnique({
                        where: { id: userCard.card_id },
                        select: {
                            id: true,
                            name: true,
                            set_name: true,
                            card_number: true, // FIXED: Use card_number instead of set_number
                            rarity: true,
                            image_url: true
                        }
                    });

                    if (!card) {
                        console.warn(`Card not found for transaction ${transaction.id}`);
                        return null;
                    }

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
                        card: {
                            id: card.id,
                            name: card.name,
                            set_name: card.set_name,
                            set_number: card.card_number, // FIXED: Map card_number to set_number for frontend
                            rarity: card.rarity,
                            image_url: card.image_url,
                            small_image_url: card.image_url // Use same image for both
                        },
                        condition: userCard.condition || 'Unknown',
                        sale_type: transaction.transaction_type,
                        sale_price: Number(transaction.amount),
                        buyer: buyer || { id: 0, name: 'Unknown', email: '' },
                        completed_at: transaction.updated_at.toISOString(), // Use updated_at as completion date
                        created_at: transaction.created_at.toISOString(),
                        notes: transaction.notes
                    };
                } catch (error) {
                    console.error(`Error processing sold transaction ${transaction.id}:`, error);
                    return null;
                }
            })
        );

        // Filter out null items and log results
        const validActiveSales = activeSalesProcessed.filter(sale => sale !== null);
        const validSoldItems = soldItemsProcessed.filter(item => item !== null);

        console.log(`Processed ${validActiveSales.length} valid active sales and ${validSoldItems.length} valid sold items`);

        const result = {
            activeSales: validActiveSales,
            soldItems: validSoldItems
        };

        return NextResponse.json(result);

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