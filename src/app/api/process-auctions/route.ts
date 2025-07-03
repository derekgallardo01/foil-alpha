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

        // Find ended auctions that haven't been processed - without problematic includes
        const endedAuctions = await prisma.userCard.findMany({
            where: {
                sale_type: 'AUCTION',
                is_for_sale: true,
                is_sold: false,
                auction_end: {
                    lte: new Date()
                }
            }
        });

        console.log(`Found ${endedAuctions.length} ended auctions to process`);

        // Get cards and owners for these auctions
        const cardIds = [...new Set(endedAuctions.map(a => a.card_id))];
        const ownerIds = [...new Set(endedAuctions.map(a => a.owner_id))];

        const [cards, owners] = await Promise.all([
            cardIds.length > 0 ? prisma.card.findMany({
                where: { id: { in: cardIds } }
            }) : [],
            ownerIds.length > 0 ? prisma.user.findMany({
                where: { id: { in: ownerIds } }
            }) : []
        ]);

        const cardMap = new Map(cards.map(c => [c.id, c]));
        const ownerMap = new Map(owners.map(o => [o.id, o]));

        // Also process expired purchase confirmations - without problematic includes
        const expiredTransactions = await prisma.transaction.findMany({
            where: {
                status: 'PENDING_BUYER_CONFIRMATION',
                created_at: {
                    lte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
                }
            }
        });

        console.log(`Found ${expiredTransactions.length} expired purchase confirmations`);

        // Get related data for expired transactions
        const expiredUserCardIds = [...new Set(expiredTransactions.map(t => t.user_card_id))];
        const expiredBuyerIds = [...new Set(expiredTransactions.map(t => t.buyer_id))];
        const expiredSellerIds = [...new Set(expiredTransactions.map(t => t.seller_id))];

        // Get expired user cards and then their related cards separately
        const [expiredUserCards, expiredBuyers, expiredSellers] = await Promise.all([
            expiredUserCardIds.length > 0 ? prisma.userCard.findMany({
                where: { id: { in: expiredUserCardIds } }
            }) : [],
            expiredBuyerIds.length > 0 ? prisma.user.findMany({
                where: { id: { in: expiredBuyerIds } }
            }) : [],
            expiredSellerIds.length > 0 ? prisma.user.findMany({
                where: { id: { in: expiredSellerIds } }
            }) : []
        ]);

        // Get cards for expired user cards
        const expiredCardIds = [...new Set(expiredUserCards.map(uc => uc.card_id))];
        const expiredCards = expiredCardIds.length > 0 ? await prisma.card.findMany({
            where: { id: { in: expiredCardIds } }
        }) : [];

        const expiredUserCardMap = new Map(expiredUserCards.map(uc => [uc.id, uc]));
        const expiredCardMap = new Map(expiredCards.map(c => [c.id, c]));
        const expiredBuyerMap = new Map(expiredBuyers.map(b => [b.id, b]));
        const expiredSellerMap = new Map(expiredSellers.map(s => [s.id, s]));

        const results = [];

        // Process ended auctions
        for (const auction of endedAuctions) {
            try {
                const card = cardMap.get(auction.card_id);
                const owner = ownerMap.get(auction.owner_id);

                if (!card || !owner) {
                    console.error(`Missing card or owner data for auction ${auction.id}`);
                    continue;
                }

                // Get highest bid - fixed field name
                const highestBid = await prisma.bid.findFirst({
                    where: {
                        userCardId: auction.id, // Fixed: was user_card_id
                        is_active: true
                    },
                    orderBy: { amount: 'desc' }
                });

                if (!highestBid) {
                    // No bids - mark auction as ended
                    await prisma.userCard.update({
                        where: { id: auction.id },
                        data: { is_for_sale: false }
                    });

                    results.push({
                        auction_id: auction.id,
                        card_name: card.name,
                        status: 'ended_no_bids'
                    });
                    continue;
                }

                // Get bidder separately
                const bidder = await prisma.user.findUnique({
                    where: { id: highestBid.bidderId } // Fixed: was bidder_id
                });

                if (!bidder) {
                    console.error(`Bidder not found for bid ${highestBid.id}`);
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

                    // Deactivate all bids - fixed field name
                    await prisma.bid.updateMany({
                        where: {
                            userCardId: auction.id, // Fixed: was user_card_id
                            is_active: true
                        },
                        data: { is_active: false }
                    });

                    results.push({
                        auction_id: auction.id,
                        card_name: card.name,
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
                            buyer_id: highestBid.bidderId, // Fixed: was bidder_id
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

                    // Get all losing bidders - fixed field name
                    const losingBids = await tx.bid.findMany({
                        where: {
                            userCardId: auction.id, // Fixed: was user_card_id
                            is_active: true,
                            id: { not: highestBid.id }
                        }
                    });

                    // Deactivate all bids (auction is over) - fixed field name
                    await tx.bid.updateMany({
                        where: {
                            userCardId: auction.id, // Fixed: was user_card_id
                            is_active: true
                        },
                        data: { is_active: false }
                    });

                    return {
                        transaction: pendingTransaction,
                        losingBidders: losingBids.map(bid => bid.bidderId) // Fixed: was bidder_id
                    };
                });

                // Create notifications
                try {
                    // Notify winner (they need to confirm within 24 hours)
                    await createAuctionWonNotifications(
                        highestBid.bidderId, // Fixed: was bidder_id
                        auction.owner_id,
                        card.name,
                        Number(highestBid.amount),
                        auction.id
                    );

                    // Notify losing bidders
                    if (result.losingBidders.length > 0) {
                        await createAuctionLostNotifications(
                            result.losingBidders,
                            card.name,
                            Number(highestBid.amount),
                            auction.id
                        );
                    }
                } catch (notificationError) {
                    console.error('Error creating auction end notifications:', notificationError);
                }

                results.push({
                    auction_id: auction.id,
                    card_name: card.name,
                    winner: bidder.name,
                    winning_bid: Number(highestBid.amount),
                    status: 'winner_needs_confirmation',
                    transaction_id: result.transaction.id
                });

            } catch (error) {
                console.error(`Error processing auction ${auction.id}:`, error);
                results.push({
                    auction_id: auction.id,
                    card_name: cardMap.get(auction.card_id)?.name || 'Unknown',
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        // Process expired purchase confirmations
        for (const expiredTransaction of expiredTransactions) {
            try {
                const userCard = expiredUserCardMap.get(expiredTransaction.user_card_id);
                const card = userCard ? expiredCardMap.get(userCard.card_id) : null;
                const buyer = expiredBuyerMap.get(expiredTransaction.buyer_id);
                const seller = expiredSellerMap.get(expiredTransaction.seller_id);

                if (!userCard || !card || !buyer || !seller) {
                    console.error(`Missing data for expired transaction ${expiredTransaction.id}`);
                    continue;
                }

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

                    // Reactivate other bids (excluding the expired winner) - fixed field name
                    await tx.bid.updateMany({
                        where: {
                            userCardId: expiredTransaction.user_card_id, // Fixed: was user_card_id
                            bidderId: { not: expiredTransaction.buyer_id } // Fixed: was bidder_id
                        },
                        data: { is_active: true }
                    });
                });

                // Create expiration notifications
                try {
                    await createPurchaseExpiredNotifications(
                        expiredTransaction.buyer_id,
                        expiredTransaction.seller_id,
                        card.name,
                        Number(expiredTransaction.amount),
                        expiredTransaction.user_card_id
                    );
                } catch (notificationError) {
                    console.error('Error creating expiration notifications:', notificationError);
                }

                results.push({
                    transaction_id: expiredTransaction.id,
                    card_name: card.name,
                    expired_buyer: buyer.name,
                    expired_amount: Number(expiredTransaction.amount),
                    status: 'confirmation_expired_relisted'
                });

            } catch (error) {
                console.error(`Error processing expired transaction ${expiredTransaction.id}:`, error);
                const userCard = expiredUserCardMap.get(expiredTransaction.user_card_id);
                const card = userCard ? expiredCardMap.get(userCard.card_id) : null;

                results.push({
                    transaction_id: expiredTransaction.id,
                    card_name: card?.name || 'Unknown',
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