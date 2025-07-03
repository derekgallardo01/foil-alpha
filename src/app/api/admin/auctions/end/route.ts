// src/app/api/admin/auctions/end/route.ts - End auction manually
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { prisma } from '../../../../lib/prisma';
import {
    createAuctionWonNotifications,
    createAuctionLostNotifications
} from '../../../../lib/notification';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 });
        }

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
                    notes: `Manually ended by admin ${session.user.name} - No bids received`
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
                        notes: `Manually ended by admin ${session.user.name} - Reserve not met (${reservePrice})`
                    }
                });

                // Deactivate all bids
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
            // Create pending transaction for winner confirmation
            const pendingTransaction = await tx.transaction.create({
                data: {
                    user_card_id: auction_id,
                    buyer_id: highestBid.bidderId,
                    seller_id: auction.owner_id,
                    amount: highestBid.amount,
                    transaction_type: 'AUCTION_WIN_PENDING',
                    status: 'PENDING_BUYER_CONFIRMATION',
                    notes: `Auction manually ended by admin ${session.user.name}. Winner has 24 hours to confirm.`
                }
            });

            // Mark auction as ended
            await tx.userCard.update({
                where: { id: auction_id },
                data: {
                    is_for_sale: false,
                    notes: `Manually ended by admin - Pending winner confirmation (Transaction #${pendingTransaction.id})`
                }
            });

            // Get losing bidders
            const losingBids = await tx.bid.findMany({
                where: {
                    userCardId: auction_id,
                    is_active: true,
                    id: { not: highestBid.id }
                }
            });

            // Deactivate all bids
            await tx.bid.updateMany({
                where: {
                    userCardId: auction_id,
                    is_active: true
                },
                data: { is_active: false }
            });

            return {
                transaction: pendingTransaction,
                losingBidders: losingBids.map(bid => bid.bidderId)
            };
        });

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