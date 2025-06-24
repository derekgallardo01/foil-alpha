// src/app/api/bids/accept/route.ts - Updated with new confirmation flow
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '../../../lib/prisma';
import { createBidAcceptedNotifications } from '../../../lib/notification';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const sellerId = parseInt(session.user.id);
        const body = await request.json();
        const { bid_id } = body;

        if (!bid_id) {
            return NextResponse.json({ error: 'bid_id is required' }, { status: 400 });
        }

        // Get bid with all related data
        const bid = await prisma.bid.findUnique({
            where: { id: bid_id },
            include: {
                userCard: {
                    include: {
                        card: true,
                        owner: true
                    }
                },
                bidder: true
            }
        });

        if (!bid || !bid.is_active) {
            return NextResponse.json({ error: 'Bid not found or not active' }, { status: 404 });
        }

        // Verify ownership
        if (bid.userCard.owner_id !== sellerId) {
            return NextResponse.json({ error: 'Only card owner can accept bids' }, { status: 403 });
        }

        // Check if card is still available
        if (bid.userCard.is_sold) {
            return NextResponse.json({ error: 'Card has already been sold' }, { status: 400 });
        }

        // Create a pending transaction instead of immediate sale
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create pending transaction
            const pendingTransaction = await tx.transaction.create({
                data: {
                    user_card_id: bid.user_card_id,
                    buyer_id: bid.bidder_id,
                    seller_id: sellerId,
                    amount: bid.amount,
                    transaction_type: 'BID_ACCEPTED_PENDING',
                    status: 'PENDING_BUYER_CONFIRMATION',
                    notes: 'Waiting for buyer confirmation within 24 hours',
                    // Will be completed when buyer confirms
                }
            });

            // 2. Mark card as pending sale (not sold yet)
            await tx.userCard.update({
                where: { id: bid.user_card_id },
                data: {
                    // Keep is_for_sale true but add a note that it's pending
                    notes: `Pending buyer confirmation - Transaction #${pendingTransaction.id}`
                }
            });

            // 3. Deactivate the accepted bid (but keep others active until confirmation)
            await tx.bid.update({
                where: { id: bid_id },
                data: {
                    is_active: false,
                    // Add metadata to track it was accepted
                }
            });

            // 4. Add expiration tracking
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

            // Store expiration info in transaction metadata or separate table
            await tx.transaction.update({
                where: { id: pendingTransaction.id },
                data: {
                    notes: `Expires at: ${expiresAt.toISOString()}. Waiting for buyer confirmation.`
                }
            });

            return {
                transaction: pendingTransaction,
                card: bid.userCard.card,
                buyer: bid.bidder,
                seller: bid.userCard.owner,
                amount: Number(bid.amount),
                expiresAt
            };
        });

        // Create notifications (outside transaction)
        try {
            await createBidAcceptedNotifications(
                bid.bidder_id,
                sellerId,
                bid.userCard.card.name,
                Number(bid.amount),
                result.transaction.id
            );
        } catch (notificationError) {
            console.error('Error creating notifications:', notificationError);
        }

        return NextResponse.json({
            success: true,
            message: 'Bid accepted! Buyer has 24 hours to confirm purchase.',
            transaction: {
                id: result.transaction.id,
                card_name: result.card.name,
                buyer_name: result.buyer.name,
                seller_name: result.seller.name,
                amount: result.amount,
                status: 'PENDING_BUYER_CONFIRMATION',
                expires_at: result.expiresAt
            }
        });

    } catch (error) {
        console.error('Error accepting bid:', error);
        return NextResponse.json(
            {
                error: 'Failed to accept bid',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}