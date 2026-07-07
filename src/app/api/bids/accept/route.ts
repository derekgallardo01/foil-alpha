// src/app/api/bids/accept/route.ts - Fixed TypeScript error
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { createBidAcceptedNotifications } from '../../../lib/notification';

export async function POST(request: NextRequest) {
    try {
        const auth = await requireUser();
        if ("response" in auth) return auth.response;
        const user = auth.user;

        const sellerId = user.id;
        const body = await request.json();
        const { bid_id } = body;

        if (!bid_id) {
            return NextResponse.json({ error: 'bid_id is required' }, { status: 400 });
        }

        // Get bid without problematic includes
        const bid = await prisma.bid.findUnique({
            where: { id: bid_id }
        });

        if (!bid || !bid.is_active) {
            return NextResponse.json({ error: 'Bid not found or not active' }, { status: 404 });
        }

        // Get related data separately
        const userCard = await prisma.userCard.findUnique({
            where: { id: bid.userCardId }
        });

        if (!userCard) {
            return NextResponse.json({ error: 'Card not found' }, { status: 404 });
        }

        const card = await prisma.card.findUnique({
            where: { id: userCard.card_id },
            select: {
                id: true,
                name: true
            }
        });

        const bidder = await prisma.user.findUnique({
            where: { id: bid.bidderId },
            select: {
                id: true,
                name: true
            }
        });

        if (!card || !bidder) {
            return NextResponse.json({ error: 'Card or bidder not found' }, { status: 404 });
        }

        // Verify ownership
        if (userCard.owner_id !== sellerId) {
            return NextResponse.json({ error: 'Only card owner can accept bids' }, { status: 403 });
        }

        // Check if card is still available
        if (userCard.is_sold) {
            return NextResponse.json({ error: 'Card has already been sold' }, { status: 400 });
        }

        // OPTIMIZED: Use faster transaction with timeout increase
        const result = await prisma.$transaction(async (tx) => {
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

            // 1. Create pending transaction (single operation) - fix field names
            const pendingTransaction = await tx.transaction.create({
                data: {
                    user_card_id: bid.userCardId, // Fix: use userCardId from bid
                    buyer_id: bid.bidderId, // Fix: use bidderId from bid
                    seller_id: sellerId,
                    amount: bid.amount,
                    transaction_type: 'BID_ACCEPTED_PENDING',
                    status: 'PENDING_BUYER_CONFIRMATION',
                    notes: `Bid accepted. Expires at: ${expiresAt.toISOString()}. Waiting for buyer confirmation.`
                }
            });

            // 2. Update card status (single operation) - fix field name
            await tx.userCard.update({
                where: { id: bid.userCardId }, // Fix: use userCardId from bid
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
                    bid.bidderId, // Fix: use bidderId from bid
                    sellerId,
                    card.name, // Use separately fetched card data
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
                card_name: card.name, // Use separately fetched card data
                buyer_name: bidder.name, // Use separately fetched bidder data
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