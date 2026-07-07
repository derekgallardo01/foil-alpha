// src/app/api/admin/auctions/end/route.ts - End auction manually
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requireAdmin } from '../../../../lib/auth';
import {
    createAuctionWonNotifications,
    createAuctionLostNotifications
} from '../../../../lib/notification';
import { releaseBidHolds } from '../../../../lib/wallet-settlement';
import { emitAppEvent } from '../../../../lib/events';

export async function POST(request: NextRequest) {
    try {
        const auth = await requireAdmin();
        if ("response" in auth) return auth.response;
        const user = auth.user;

        const body = await request.json();
        const { auction_id } = body;

        if (!auction_id) {
            return NextResponse.json({ error: 'auction_id is required' }, { status: 400 });
        }

        // Get the auction with explicit typing
        const auction = await prisma.userCard.findUnique({
            where: { id: auction_id }
        });

        if (!auction) {
            return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
        }

        if (auction.sale_type !== 'AUCTION' || !auction.is_for_sale) {
            return NextResponse.json({ error: 'Card is not an active auction' }, { status: 400 });
        }

        // Get the card and owner separately to avoid type issues
        const card = await prisma.card.findUnique({
            where: { id: auction.card_id }
        });

        const owner = await prisma.user.findUnique({
            where: { id: auction.owner_id }
        });

        if (!card || !owner) {
            return NextResponse.json({ error: 'Card or owner not found' }, { status: 404 });
        }

        // Get highest bid
        const highestBid = await prisma.bid.findFirst({
            where: {
                userCardId: auction_id,
                is_active: true
            },
            orderBy: { amount: 'desc' }
        });

        if (!highestBid) {
            // No bids - just end auction
            await prisma.userCard.update({
                where: { id: auction_id },
                data: {
                    is_for_sale: false,
                    notes: `Manually ended by admin ${user.name} - No bids received`
                }
            });

            return NextResponse.json({
                success: true,
                message: 'Auction ended - no bids received',
                auction_id,
                card_name: card.name
            });
        }

        // Get the bidder separately
        const bidder = await prisma.user.findUnique({
            where: { id: highestBid.bidderId }
        });

        if (!bidder) {
            return NextResponse.json({ error: 'Bidder not found' }, { status: 404 });
        }

        // Check reserve price
        const reservePrice = Number(auction.reserve_price) || 0;
        if (Number(highestBid.amount) < reservePrice) {
            // Reserve not met
            await prisma.$transaction(async (tx) => {
                await tx.userCard.update({
                    where: { id: auction_id },
                    data: {
                        is_for_sale: false,
                        notes: `Manually ended by admin ${user.name} - Reserve not met (${reservePrice})`
                    }
                });

                // Reserve not met: no sale — release every bidder's escrow hold,
                // then deactivate all bids.
                await releaseBidHolds(tx, { auctionId: auction_id });
                await tx.bid.updateMany({
                    where: {
                        userCardId: auction_id,
                        is_active: true
                    },
                    data: { is_active: false }
                });
            });

            return NextResponse.json({
                success: true,
                message: 'Auction ended - reserve price not met',
                auction_id,
                card_name: card.name,
                highest_bid: Number(highestBid.amount),
                reserve_price: reservePrice
            });
        }

        // Winner found - create pending transaction
        const result = await prisma.$transaction(async (tx) => {
            // Atomically CLAIM the card (end the listing). If a concurrent
            // auction-end already claimed it, skip — prevents two pending
            // transactions for one card (which would let it be sold twice).
            const cardClaimed = await tx.userCard.updateMany({
                where: { id: auction_id, is_sold: false, is_for_sale: true },
                data: { is_for_sale: false }
            });
            if (cardClaimed.count !== 1) return null;

            // Create pending transaction for winner confirmation
            const pendingTransaction = await tx.transaction.create({
                data: {
                    user_card_id: auction_id,
                    buyer_id: highestBid.bidderId,
                    seller_id: auction.owner_id,
                    amount: highestBid.amount,
                    transaction_type: 'AUCTION_WIN_PENDING',
                    status: 'PENDING_BUYER_CONFIRMATION',
                    notes: `Auction manually ended by admin ${user.name}. Winner has 24 hours to confirm.`
                }
            });

            // Record the pending-transaction ref on the (already-claimed) card.
            await tx.userCard.update({
                where: { id: auction_id },
                data: {
                    notes: `Manually ended by admin - Pending winner confirmation (Transaction #${pendingTransaction.id})`
                }
            });

            // Get losing bidders (for notifications). Bids stay ACTIVE and their
            // escrow stays held until the winner confirms (releases losers) or
            // declines (auction continues with them) — see bids/confirm-purchase.
            const losingBids = await tx.bid.findMany({
                where: {
                    userCardId: auction_id,
                    is_active: true,
                    id: { not: highestBid.id }
                }
            });

            return {
                transaction: pendingTransaction,
                losingBidders: losingBids.map(bid => bid.bidderId)
            };
        });

        if (!result) {
            return NextResponse.json({ error: 'Auction is no longer available (already ended)' }, { status: 409 });
        }

        // Send notifications
        try {
            // Notify winner
            await createAuctionWonNotifications(
                highestBid.bidderId,
                auction.owner_id,
                card.name,
                Number(highestBid.amount),
                auction_id
            );

            // Notify losers
            if (result.losingBidders.length > 0) {
                await createAuctionLostNotifications(
                    result.losingBidders,
                    card.name,
                    Number(highestBid.amount),
                    auction_id
                );
            }
        } catch (notificationError) {
            console.error('Error creating notifications:', notificationError);
        }

        emitAppEvent({ type: 'auction_ended', auctionId: auction_id });

        return NextResponse.json({
            success: true,
            message: 'Auction ended successfully',
            auction_id,
            card_name: card.name,
            winner: bidder.name,
            winning_bid: Number(highestBid.amount),
            transaction_id: result.transaction.id
        });

    } catch (error) {
        console.error('Error ending auction:', error);
        return NextResponse.json(
            {
                error: 'Failed to end auction',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}