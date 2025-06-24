// src/app/api/process-auctions/route.ts - Updated with new confirmation flow
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
import {
    createAuctionWonNotifications,
    createAuctionLostNotifications,
    createPurchaseExpiredNotifications
} from '../../lib/notification';

export async function POST(request: NextRequest) {
    try {
        // This endpoint should be called by a cron job or admin
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('Processing ended auctions...');

        // Find ended auctions that haven't been processed
        const endedAuctions = await prisma.userCard.findMany({
            where: {
                sale_type: 'AUCTION',
                is_for_sale: true,
                is_sold: false,
                auction_end: {
                    lte: new Date()
                }
            },
            include: {
                card: true,
                owner: true
            }
        });

        console.log(`Found ${endedAuctions.length} ended auctions to process`);

        // Also process expired purchase confirmations
        const expiredTransactions = await prisma.transaction.findMany({
            where: {
                status: 'PENDING_BUYER_CONFIRMATION',
                created_at: {
                    lte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
                }
            },
            include: {
                userCard: {
                    include: {
                        card: true
                    }
                },
                buyer: true,
                seller: true
            }
        });

        console.log(`Found ${expiredTransactions.length} expired purchase confirmations`);

        const results = [];

        // Process ended auctions
        for (const auction of endedAuctions) {
            try {
                // Get highest bid
                const highestBid = await prisma.bid.findFirst({
                    where: {
                        user_card_id: auction.id,
                        is_active: true
                    },
                    orderBy: { amount: 'desc' },
                    include: {
                        bidder: true
                    }
                });

                if (!highestBid) {
                    // No bids - mark auction as ended
                    await prisma.userCard.update({
                        where: { id: auction.id },
                        data: { is_for_sale: false }
                    });

                    results.push({
                        auction_id: auction.id,
                        card_name: auction.card.name,
                        status: 'ended_no_bids'
                    });
                    continue;
                }

                // Check if bid meets reserve price
                const reservePrice = Number(auction.reserve_price) || 0;
                if (Number(highestBid.amount) < reservePrice) {
                    // Reserve not met - end auction
                    await prisma.userCard.update({
                        where: { id: auction.id },
                        data: { is_for_sale: false }
                    });

                    // Deactivate all bids
                    await prisma.bid.updateMany({
                        where: {
                            user_card_id: auction.id,
                            is_active: true
                        },
                        data: { is_active: false }
                    });

                    results.push({
                        auction_id: auction.id,
                        card_name: auction.card.name,
                        status: 'ended_reserve_not_met',
                        highest_bid: Number(highestBid.amount),
                        reserve_price: reservePrice
                    });
                    continue;
                }

                // Winner found - create pending transaction for confirmation
                const result = await prisma.$transaction(async (tx) => {
                    // Create pending transaction for winner to confirm
                    const pendingTransaction = await tx.transaction.create({
                        data: {
                            user_card_id: auction.id,
                            buyer_id: highestBid.bidder_id,
                            seller_id: auction.owner_id,
                            amount: highestBid.amount,
                            transaction_type: 'AUCTION_WIN_PENDING',
                            status: 'PENDING_BUYER_CONFIRMATION',
                            notes: `Auction ended. Winner has 24 hours to confirm purchase.`
                        }
                    });

                    // Mark auction as ended but not sold yet
                    await tx.userCard.update({
                        where: { id: auction.id },
                        data: {
                            is_for_sale: false, // Auction ended
                            notes: `Pending winner confirmation - Transaction #${pendingTransaction.id}`
                        }
                    });

                    // Get all losing bidders
                    const losingBids = await tx.bid.findMany({
                        where: {
                            user_card_id: auction.id,
                            is_active: true,
                            id: { not: highestBid.id }
                        },
                        include: {
                            bidder: true
                        }
                    });

                    // Deactivate all bids (auction is over)
                    await tx.bid.updateMany({
                        where: {
                            user_card_id: auction.id,
                            is_active: true
                        },
                        data: { is_active: false }
                    });

                    return {
                        transaction: pendingTransaction,
                        losingBidders: losingBids.map(bid => bid.bidder_id)
                    };
                });

                // Create notifications
                try {
                    // Notify winner (they need to confirm within 24 hours)
                    await createAuctionWonNotifications(
                        highestBid.bidder_id,
                        auction.owner_id,
                        auction.card.name,
                        Number(highestBid.amount),
                        auction.id
                    );

                    // Notify losing bidders
                    if (result.losingBidders.length > 0) {
                        await createAuctionLostNotifications(
                            result.losingBidders,
                            auction.card.name,
                            Number(highestBid.amount),
                            auction.id
                        );
                    }
                } catch (notificationError) {
                    console.error('Error creating auction end notifications:', notificationError);
                }

                results.push({
                    auction_id: auction.id,
                    card_name: auction.card.name,
                    winner: highestBid.bidder.name,
                    winning_bid: Number(highestBid.amount),
                    status: 'winner_needs_confirmation',
                    transaction_id: result.transaction.id
                });

            } catch (error) {
                console.error(`Error processing auction ${auction.id}:`, error);
                results.push({
                    auction_id: auction.id,
                    card_name: auction.card.name,
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        // Process expired purchase confirmations
        for (const expiredTransaction of expiredTransactions) {
            try {
                await prisma.$transaction(async (tx) => {
                    // Mark transaction as expired
                    await tx.transaction.update({
                        where: { id: expiredTransaction.id },
                        data: {
                            status: 'EXPIRED',
                            transaction_type: 'AUCTION_WIN_EXPIRED',
                            notes: 'Purchase confirmation expired after 24 hours'
                        }
                    });

                    // Reset card to available for sale (relist)
                    await tx.userCard.update({
                        where: { id: expiredTransaction.user_card_id },
                        data: {
                            is_for_sale: true,
                            sale_type: 'AUCTION',
                            // Extend auction by 7 days or set new end time
                            auction_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                            notes: 'Relisted due to expired purchase confirmation'
                        }
                    });

                    // Reactivate other bids (excluding the expired winner)
                    await tx.bid.updateMany({
                        where: {
                            user_card_id: expiredTransaction.user_card_id,
                            bidder_id: { not: expiredTransaction.buyer_id }
                        },
                        data: { is_active: true }
                    });
                });

                // Create expiration notifications
                try {
                    await createPurchaseExpiredNotifications(
                        expiredTransaction.buyer_id,
                        expiredTransaction.seller_id,
                        expiredTransaction.userCard.card.name,
                        Number(expiredTransaction.amount),
                        expiredTransaction.user_card_id
                    );
                } catch (notificationError) {
                    console.error('Error creating expiration notifications:', notificationError);
                }

                results.push({
                    transaction_id: expiredTransaction.id,
                    card_name: expiredTransaction.userCard.card.name,
                    expired_buyer: expiredTransaction.buyer.name,
                    expired_amount: Number(expiredTransaction.amount),
                    status: 'confirmation_expired_relisted'
                });

            } catch (error) {
                console.error(`Error processing expired transaction ${expiredTransaction.id}:`, error);
                results.push({
                    transaction_id: expiredTransaction.id,
                    card_name: expiredTransaction.userCard.card.name,
                    status: 'expiration_error',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        console.log('Auction processing complete:', results);

        return NextResponse.json({
            success: true,
            processed_auctions: endedAuctions.length,
            processed_expirations: expiredTransactions.length,
            total_processed: results.length,
            results
        });

    } catch (error) {
        console.error('Error in auction processing:', error);
        return NextResponse.json(
            { error: 'Failed to process auctions' },
            { status: 500 }
        );
    }
}