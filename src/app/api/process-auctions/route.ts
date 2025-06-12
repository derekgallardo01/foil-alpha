// src/app/api/process-auctions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

// POST /api/process-auctions - Process ended auctions (cron job endpoint)
export async function POST(request: NextRequest) {
    try {
        // This should be called by a cron job or scheduled task
        // You might want to add authentication for this endpoint

        const now = new Date();

        // Find all auctions that have ended but haven't been processed
        const endedAuctions = await prisma.userCard.findMany({
            where: {
                sale_type: 'AUCTION',
                auction_end: { lte: now },
                is_for_sale: true,
                is_sold: false
            },
            include: {
                card: true,
                owner: { select: { id: true, name: true, email: true } },
                bids: {
                    where: { is_active: true },
                    orderBy: { amount: 'desc' },
                    include: {
                        bidder: { select: { id: true, name: true, email: true } }
                    }
                }
            }
        });

        const results = [];

        for (const auction of endedAuctions) {
            try {
                if (auction.bids.length > 0) {
                    // There are bids - process the sale to highest bidder
                    const winningBid = auction.bids[0];
                    const salePrice = Number(winningBid.amount);

                    await prisma.$transaction(async (tx) => {
                        // 1. Mark the original card as sold
                        await tx.userCard.update({
                            where: { id: auction.id },
                            data: {
                                is_sold: true,
                                is_for_sale: false
                            }
                        });

                        // 2. Create a new user card for the winner
                        const newUserCard = await tx.userCard.create({
                            data: {
                                card_id: auction.card_id,
                                owner_id: winningBid.bidder_id,
                                condition: auction.condition,
                                notes: `Won auction from ${auction.owner.name} for $${salePrice.toFixed(2)}`,
                                is_for_sale: false,
                                is_sold: false
                            }
                        });

                        // 3. Create transaction history for the seller (sale)
                        await tx.cardHistory.create({
                            data: {
                                user_card_id: auction.id,
                                from_user_id: auction.owner_id,
                                to_user_id: winningBid.bidder_id,
                                transaction_type: 'AUCTION_SALE',
                                price: salePrice,
                                notes: `Auction won by ${winningBid.bidder.name}`
                            }
                        });

                        // 4. Create transaction history for the buyer (purchase)
                        await tx.cardHistory.create({
                            data: {
                                user_card_id: newUserCard.id,
                                from_user_id: auction.owner_id,
                                to_user_id: winningBid.bidder_id,
                                transaction_type: 'AUCTION_WIN',
                                price: salePrice,
                                notes: `Won auction from ${auction.owner.name}`
                            }
                        });

                        // 5. Deactivate all bids for this auction
                        await tx.bid.updateMany({
                            where: {
                                user_card_id: auction.id,
                                is_active: true
                            },
                            data: {
                                is_active: false
                            }
                        });
                    });

                    results.push({
                        auction_id: auction.id,
                        card_name: auction.card.name,
                        winner: winningBid.bidder.name,
                        winning_bid: salePrice,
                        status: 'SOLD'
                    });

                } else {
                    // No bids - auction ends without sale
                    await prisma.userCard.update({
                        where: { id: auction.id },
                        data: {
                            is_for_sale: false,
                            sale_type: null,
                            reserve_price: null,
                            auction_end: null
                        }
                    });

                    // Create history entry
                    await prisma.cardHistory.create({
                        data: {
                            user_card_id: auction.id,
                            to_user_id: auction.owner_id,
                            transaction_type: 'AUCTION_NO_SALE',
                            notes: 'Auction ended with no bids'
                        }
                    });

                    results.push({
                        auction_id: auction.id,
                        card_name: auction.card.name,
                        status: 'NO_SALE'
                    });
                }

            } catch (error) {
                console.error(`Error processing auction ${auction.id}:`, error);
                results.push({
                    auction_id: auction.id,
                    card_name: auction.card.name,
                    status: 'ERROR',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        return NextResponse.json({
            message: `Processed ${endedAuctions.length} ended auctions`,
            results
        });

    } catch (error) {
        console.error('Error processing auctions:', error);
        return NextResponse.json(
            {
                error: 'Failed to process auctions',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

// GET /api/process-auctions - Get auctions that need processing (for monitoring)
export async function GET() {
    try {
        const now = new Date();

        const endedAuctions = await prisma.userCard.findMany({
            where: {
                sale_type: 'AUCTION',
                auction_end: { lte: now },
                is_for_sale: true,
                is_sold: false
            },
            include: {
                card: { select: { name: true } },
                owner: { select: { name: true } },
                _count: {
                    select: {
                        bids: {
                            where: { is_active: true }
                        }
                    }
                }
            }
        });

        return NextResponse.json({
            count: endedAuctions.length,
            auctions: endedAuctions.map(auction => ({
                id: auction.id,
                card_name: auction.card.name,
                owner_name: auction.owner.name,
                auction_end: auction.auction_end,
                bid_count: auction._count.bids,
                reserve_price: auction.reserve_price
            }))
        });

    } catch (error) {
        console.error('Error fetching auctions to process:', error);
        return NextResponse.json(
            { error: 'Failed to fetch auctions' },
            { status: 500 }
        );
    }
}