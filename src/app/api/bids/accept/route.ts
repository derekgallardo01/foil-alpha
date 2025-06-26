// src/app/api/bids/accept/route.ts - Fixed TypeScript error
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

        // OPTIMIZED: Get bid with minimal data first
        const bid = await prisma.bid.findUnique({
            where: { id: bid_id },
            include: {
                userCard: {
                    select: {
                        id: true,
                        owner_id: true,
                        is_sold: true,
                        card: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },
                bidder: {
                    select: {
                        id: true,
                        name: true
                    }
                }
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

        // OPTIMIZED: Use faster transaction with timeout increase
        const result = await prisma.$transaction(async (tx) => {
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

            // 1. Create pending transaction (single operation)
            const pendingTransaction = await tx.transaction.create({
                data: {
                    user_card_id: bid.user_card_id,
                    buyer_id: bid.bidder_id,
                    seller_id: sellerId,
                    amount: bid.amount,
                    transaction_type: 'BID_ACCEPTED_PENDING',
                    status: 'PENDING_BUYER_CONFIRMATION',
                    notes: `Bid accepted. Expires at: ${expiresAt.toISOString()}. Waiting for buyer confirmation.`
                }
            });

            // 2. Update card status (single operation)
            await tx.userCard.update({
                where: { id: bid.user_card_id },
                data: {
                    notes: `Pending buyer confirmation - Transaction #${pendingTransaction.id}`
                }
            });

            // 3. Deactivate the accepted bid (single operation)
            await tx.bid.update({
                where: { id: bid_id },
                data: { is_active: false }
            });

            return {
                transaction: pendingTransaction,
                expiresAt,
                amount: Number(bid.amount)
            };
        }, {
            timeout: 10000, // Increase timeout to 10 seconds
            isolationLevel: 'ReadCommitted' // Use faster isolation level
        });

        // OPTIMIZED: Create notifications outside transaction with error handling
        setImmediate(async () => {
            try {
                await createBidAcceptedNotifications(
                    bid.bidder_id,
                    sellerId,
                    bid.userCard.card.name,
                    Number(bid.amount),
                    result.transaction.id
                );
            } catch (notificationError) {
                console.error('Error creating notifications (async):', notificationError);
            }
        });

        return NextResponse.json({
            success: true,
            message: 'Bid accepted! Buyer has 24 hours to confirm purchase.',
            transaction: {
                id: result.transaction.id,
                card_name: bid.userCard.card.name,
                buyer_name: bid.bidder.name,
                amount: result.amount,
                status: 'PENDING_BUYER_CONFIRMATION',
                expires_at: result.expiresAt
            }
        });

    } catch (error: unknown) {
        console.error('Error accepting bid:', error);

        // FIXED: Proper TypeScript error handling
        if (error && typeof error === 'object' && 'code' in error) {
            const prismaError = error as { code: string; message?: string };
            if (prismaError.code === 'P2028') {
                return NextResponse.json(
                    { error: 'Transaction timeout - please try again' },
                    { status: 408 }
                );
            }
        }

        return NextResponse.json(
            {
                error: 'Failed to accept bid',
                details: error instanceof Error ? error.message : 'Unknown error occurred'
            },
            { status: 500 }
        );
    }
}