// src/app/api/bids/route.ts - Updated with new bidding flow (no fund freezing)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { prisma } from '../../lib/prisma';
import { createBidNotifications, createBidOutbidNotification } from '../../lib/notification';

// GET /api/bids - Get bids for a card or user's bids
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const userCardId = searchParams.get('user_card_id');
        const userId = searchParams.get('user_id');

        let where: any = {};

        if (userCardId) {
            where.userCardId = parseInt(userCardId);
        } else if (userId) {
            where.bidderId = parseInt(userId);
        } else {
            where.bidderId = parseInt(session.user.id);
        }

        const bids = await prisma.bid.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        // Get related data separately for each bid
        const bidsWithDetails = await Promise.all(
            bids.map(async (bid) => {
                const userCard = await prisma.userCard.findUnique({
                    where: { id: bid.userCardId }
                });

                const card = userCard ? await prisma.card.findUnique({
                    where: { id: userCard.card_id }
                }) : null;

                const owner = userCard ? await prisma.user.findUnique({
                    where: { id: userCard.owner_id },
                    select: { id: true, name: true, email: true }
                }) : null;

                const bidder = await prisma.user.findUnique({
                    where: { id: bid.bidderId },
                    select: { id: true, name: true, email: true }
                });

                return {
                    id: bid.id,
                    user_card_id: bid.userCardId,
                    bidder: bidder,
                    amount: Number(bid.amount),
                    is_active: bid.is_active,
                    created_at: bid.createdAt,
                    card: card ? {
                        id: card.id,
                        name: card.name,
                        set_name: card.set_name,
                        image_url: card.image_url
                    } : null,
                    owner: owner,
                    auction_end: userCard?.auction_end,
                    current_highest_bid: Number(bid.amount)
                };
            })
        );

        return NextResponse.json(bidsWithDetails.filter(bid => bid.card !== null));

    } catch (error) {
        console.error('Error fetching bids:', error);
        return NextResponse.json(
            { error: 'Failed to fetch bids' },
            { status: 500 }
        );
    }
}

// POST /api/bids - Place a new bid (NO fund freezing)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const bidderId = parseInt(session.user.id);
        const body = await request.json();
        const { user_card_id, amount } = body;

        if (!user_card_id || !amount || amount <= 0) {
            return NextResponse.json({
                error: 'user_card_id and positive amount are required'
            }, { status: 400 });
        }

        const bidAmount = Number(amount);

        // Get the card being bid on
        const userCard = await prisma.userCard.findUnique({
            where: { id: user_card_id }
        });

        if (!userCard) {
            return NextResponse.json({ error: 'Card not found' }, { status: 404 });
        }

        // Get card details
        const card = await prisma.card.findUnique({
            where: { id: userCard.card_id }
        });

        // Get owner details
        const owner = await prisma.user.findUnique({
            where: { id: userCard.owner_id },
            select: { id: true, name: true }
        });

        if (!card || !owner) {
            return NextResponse.json({ error: 'Card or owner not found' }, { status: 404 });
        }

        // Validation checks
        if (userCard.owner_id === bidderId) {
            return NextResponse.json({ error: 'Cannot bid on your own card' }, { status: 400 });
        }

        if (!userCard.is_for_sale || userCard.sale_type !== 'AUCTION') {
            return NextResponse.json({ error: 'Card is not available for auction' }, { status: 400 });
        }

        if (userCard.is_sold) {
            return NextResponse.json({ error: 'Card has already been sold' }, { status: 400 });
        }

        if (userCard.auction_end && new Date() > userCard.auction_end) {
            return NextResponse.json({ error: 'Auction has ended' }, { status: 400 });
        }

        // Check if bid meets minimum requirements
        const reservePrice = Number(userCard.reserve_price) || 0;
        if (bidAmount < reservePrice) {
            return NextResponse.json({
                error: `Bid must be at least $${reservePrice.toFixed(2)} (reserve price)`
            }, { status: 400 });
        }

        // Get current highest bid
        const currentHighestBid = await prisma.bid.findFirst({
            where: {
                userCardId: user_card_id,
                is_active: true
            },
            orderBy: { amount: 'desc' }
        });

        // Get bidder details for the highest bid
        const currentHighestBidder = currentHighestBid ? await prisma.user.findUnique({
            where: { id: currentHighestBid.bidderId },
            select: { id: true, name: true }
        }) : null;

        const currentHighestBidWithBidder = currentHighestBid ? {
            ...currentHighestBid,
            bidder: currentHighestBidder
        } : null;

        if (currentHighestBid && bidAmount <= Number(currentHighestBid.amount)) {
            return NextResponse.json({
                error: `Bid must be higher than current highest bid of $${Number(currentHighestBid.amount).toFixed(2)}`
            }, { status: 400 });
        }

        // Check if bidder has sufficient balance (but don't freeze it)
        const bidderWallet = await prisma.userWallet.findUnique({
            where: { user_id: bidderId }
        });

        if (!bidderWallet) {
            return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
        }

        const availableBalance = Number(bidderWallet.balance) - Number(bidderWallet.frozen_balance);
        if (availableBalance < bidAmount) {
            return NextResponse.json({
                error: `Insufficient balance. Available: $${availableBalance.toFixed(2)}, Required: $${bidAmount.toFixed(2)}`
            }, { status: 400 });
        }

        // Execute the bidding transaction (NO fund freezing)
        const result = await prisma.$transaction(async (tx) => {
            // 1. If there's a previous bid from this user, deactivate it
            const previousBidFromUser = await tx.bid.findFirst({
                where: {
                    userCardId: user_card_id,
                    bidderId: bidderId,
                    is_active: true
                }
            });

            if (previousBidFromUser) {
                await tx.bid.update({
                    where: { id: previousBidFromUser.id },
                    data: { is_active: false }
                });
            }

            // 2. Create the new bid (NO fund freezing)
            const newBid = await tx.bid.create({
                data: {
                    userCardId: user_card_id,
                    bidderId: bidderId,
                    amount: bidAmount,
                    is_active: true
                }
            });

            return {
                bid: newBid,
                previousHighestBid: currentHighestBidWithBidder
            };
        });

        // Create notifications (outside of transaction for better error handling)
        try {
            // Notify card owner of new bid
            await createBidNotifications(
                userCard.owner_id,
                bidderId,
                card.name,
                bidAmount,
                result.bid.id
            );

            // Notify previous highest bidder if they were outbid
            if (result.previousHighestBid && result.previousHighestBid.bidderId !== bidderId) {
                await createBidOutbidNotification(
                    result.previousHighestBid.bidderId,
                    card.name,
                    Number(result.previousHighestBid.amount),
                    bidAmount,
                    result.bid.id
                );
            }
        } catch (notificationError) {
            console.error('Error creating notifications:', notificationError);
            // Don't fail the entire request for notification errors
        }

        return NextResponse.json({
            success: true,
            bid: {
                id: result.bid.id,
                user_card_id: user_card_id,
                amount: bidAmount,
                card_name: card.name,
                created_at: result.bid.createdAt
            },
            message: 'Bid placed successfully! No funds have been reserved.'
        });

    } catch (error) {
        console.error('Error placing bid:', error);
        return NextResponse.json(
            {
                error: 'Failed to place bid',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

// DELETE /api/bids - Cancel a bid (no fund unfreezing needed)
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = parseInt(session.user.id);
        const { searchParams } = new URL(request.url);
        const bidId = searchParams.get('bid_id');

        if (!bidId) {
            return NextResponse.json({ error: 'bid_id is required' }, { status: 400 });
        }

        const bid = await prisma.bid.findUnique({
            where: { id: parseInt(bidId) }
        });

        if (!bid) {
            return NextResponse.json({ error: 'Bid not found' }, { status: 404 });
        }

        if (bid.bidderId !== userId) {
            return NextResponse.json({ error: 'Can only cancel your own bids' }, { status: 403 });
        }

        if (!bid.is_active) {
            return NextResponse.json({ error: 'Bid is not active' }, { status: 400 });
        }

        // Get the user card to check auction end
        const userCard = await prisma.userCard.findUnique({
            where: { id: bid.userCardId }
        });

        if (!userCard) {
            return NextResponse.json({ error: 'Associated card not found' }, { status: 404 });
        }

        // Check if auction has ended
        if (userCard.auction_end && new Date() > userCard.auction_end) {
            return NextResponse.json({ error: 'Cannot cancel bid after auction has ended' }, { status: 400 });
        }

        // Simply deactivate the bid (no fund unfreezing needed)
        await prisma.bid.update({
            where: { id: parseInt(bidId) },
            data: { is_active: false }
        });

        return NextResponse.json({
            success: true,
            message: 'Bid cancelled successfully'
        });

    } catch (error) {
        console.error('Error cancelling bid:', error);
        return NextResponse.json(
            {
                error: 'Failed to cancel bid',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}