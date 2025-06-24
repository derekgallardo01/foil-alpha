// src/app/api/bids/confirm-purchase/route.ts - New buyer confirmation API
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '../../../lib/prisma';
import {
    createPurchaseConfirmedNotifications,
    createPurchaseDeclinedNotifications
} from '../../../lib/notification';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const buyerId = parseInt(session.user.id);
        const body = await request.json();
        const { transaction_id, confirm_purchase } = body;

        if (!transaction_id || typeof confirm_purchase !== 'boolean') {
            return NextResponse.json({
                error: 'transaction_id and confirm_purchase (boolean) are required'
            }, { status: 400 });
        }

        // Get the pending transaction
        const transaction = await prisma.transaction.findUnique({
            where: { id: transaction_id },
            include: {
                userCard: {
                    include: {
                        card: true,
                        owner: true
                    }
                },
                buyer: true,
                seller: true
            }
        });

        if (!transaction) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        if (transaction.buyer_id !== buyerId) {
            return NextResponse.json({ error: 'Only the buyer can confirm this purchase' }, { status: 403 });
        }

        if (transaction.status !== 'PENDING_BUYER_CONFIRMATION') {
            return NextResponse.json({ error: 'Transaction is not pending confirmation' }, { status: 400 });
        }

        // Check if transaction has expired (24 hours)
        const createdAt = new Date(transaction.created_at);
        const expirationTime = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
        const now = new Date();

        if (now > expirationTime) {
            return NextResponse.json({
                error: 'Purchase confirmation window has expired (24 hours)'
            }, { status: 400 });
        }

        if (confirm_purchase) {
            // BUYER CONFIRMS PURCHASE
            // Check wallet balance before proceeding
            const buyerWallet = await prisma.userWallet.findUnique({
                where: { user_id: buyerId }
            });

            if (!buyerWallet) {
                return NextResponse.json({ error: 'Buyer wallet not found' }, { status: 404 });
            }

            const availableBalance = Number(buyerWallet.balance) - Number(buyerWallet.frozen_balance);
            const purchaseAmount = Number(transaction.amount);

            if (availableBalance < purchaseAmount) {
                return NextResponse.json({
                    error: `Insufficient balance. Available: $${availableBalance.toFixed(2)}, Required: $${purchaseAmount.toFixed(2)}`
                }, { status: 400 });
            }

            // Process the purchase
            const result = await prisma.$transaction(async (tx) => {
                // 1. Complete the transaction
                const completedTransaction = await tx.transaction.update({
                    where: { id: transaction_id },
                    data: {
                        status: 'COMPLETED',
                        transaction_type: 'BID_PURCHASE_CONFIRMED',
                        completed_at: new Date(),
                        notes: 'Purchase confirmed by buyer'
                    }
                });

                // 2. Transfer card ownership
                await tx.userCard.update({
                    where: { id: transaction.user_card_id },
                    data: {
                        is_sold: true,
                        is_for_sale: false,
                        owner_id: buyerId,
                        notes: null // Clear pending notes
                    }
                });

                // 3. Process wallet transactions
                const [buyerWallet, sellerWallet] = await Promise.all([
                    tx.userWallet.findUnique({ where: { user_id: buyerId } }),
                    tx.userWallet.findUnique({ where: { user_id: transaction.seller_id } })
                ]);

                if (!buyerWallet || !sellerWallet) {
                    throw new Error('Wallet not found');
                }

                // Update buyer wallet (deduct funds)
                const updatedBuyerWallet = await tx.userWallet.update({
                    where: { user_id: buyerId },
                    data: {
                        balance: { decrement: purchaseAmount }
                    }
                });

                // Update seller wallet (add funds)
                const updatedSellerWallet = await tx.userWallet.update({
                    where: { user_id: transaction.seller_id },
                    data: {
                        balance: { increment: purchaseAmount }
                    }
                });

                // Create wallet transaction records
                await Promise.all([
                    // Buyer transaction
                    tx.walletTransaction.create({
                        data: {
                            user_id: buyerId,
                            transaction_type: 'PURCHASE',
                            amount: -purchaseAmount,
                            balance_before: Number(buyerWallet.balance),
                            balance_after: Number(updatedBuyerWallet.balance),
                            description: `Purchased ${transaction.userCard.card.name}`,
                            reference_id: transaction_id,
                            reference_type: 'TRANSACTION'
                        }
                    }),
                    // Seller transaction
                    tx.walletTransaction.create({
                        data: {
                            user_id: transaction.seller_id,
                            transaction_type: 'SALE',
                            amount: purchaseAmount,
                            balance_before: Number(sellerWallet.balance),
                            balance_after: Number(updatedSellerWallet.balance),
                            description: `Sold ${transaction.userCard.card.name}`,
                            reference_id: transaction_id,
                            reference_type: 'TRANSACTION'
                        }
                    })
                ]);

                // 4. Deactivate all other bids for this card
                await tx.bid.updateMany({
                    where: {
                        user_card_id: transaction.user_card_id,
                        is_active: true
                    },
                    data: { is_active: false }
                });

                // 5. Create card history record
                await tx.cardHistory.create({
                    data: {
                        user_card_id: transaction.user_card_id,
                        from_user_id: transaction.seller_id,
                        to_user_id: buyerId,
                        transaction_type: 'BID_SALE_CONFIRMED',
                        price: purchaseAmount,
                        notes: `Bid accepted and confirmed for ${purchaseAmount.toFixed(2)}`
                    }
                });

                return {
                    transaction: completedTransaction,
                    card: transaction.userCard.card,
                    amount: purchaseAmount
                };
            });

            // Create success notifications
            try {
                await createPurchaseConfirmedNotifications(
                    buyerId,
                    transaction.seller_id,
                    transaction.userCard.card.name,
                    purchaseAmount,
                    transaction_id
                );
            } catch (notificationError) {
                console.error('Error creating notifications:', notificationError);
            }

            return NextResponse.json({
                success: true,
                message: 'Purchase confirmed successfully!',
                transaction: {
                    id: result.transaction.id,
                    card_name: result.card.name,
                    amount: result.amount,
                    status: 'COMPLETED'
                }
            });

        } else {
            // BUYER DECLINES PURCHASE
            const result = await prisma.$transaction(async (tx) => {
                // 1. Update transaction as declined
                await tx.transaction.update({
                    where: { id: transaction_id },
                    data: {
                        status: 'CANCELLED',
                        transaction_type: 'BID_PURCHASE_DECLINED',
                        notes: 'Purchase declined by buyer'
                    }
                });

                // 2. Reset card status (make available for sale again)
                await tx.userCard.update({
                    where: { id: transaction.user_card_id },
                    data: {
                        is_for_sale: true, // Back to auction
                        notes: null // Clear pending notes
                    }
                });

                // 3. Reactivate other bids (they can still compete)
                await tx.bid.updateMany({
                    where: {
                        user_card_id: transaction.user_card_id,
                        bidder_id: { not: buyerId } // Don't reactivate decliner's bids
                    },
                    data: { is_active: true }
                });

                return {
                    card: transaction.userCard.card,
                    amount: Number(transaction.amount)
                };
            });

            // Create decline notifications
            try {
                await createPurchaseDeclinedNotifications(
                    buyerId,
                    transaction.seller_id,
                    transaction.userCard.card.name,
                    Number(transaction.amount),
                    transaction.user_card_id
                );
            } catch (notificationError) {
                console.error('Error creating notifications:', notificationError);
            }

            return NextResponse.json({
                success: true,
                message: 'Purchase declined. The auction continues with other bidders.',
                transaction: {
                    id: transaction_id,
                    card_name: result.card.name,
                    amount: result.amount,
                    status: 'DECLINED'
                }
            });
        }

    } catch (error) {
        console.error('Error confirming purchase:', error);
        return NextResponse.json(
            {
                error: 'Failed to process purchase confirmation',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}