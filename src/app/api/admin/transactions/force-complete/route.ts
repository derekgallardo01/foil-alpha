// src/app/api/admin/transactions/force-complete/route.ts - Force complete transaction
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { prisma } from '../../../../lib/prisma';
import { createPurchaseConfirmedNotifications } from '../../../../lib/notification';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 });
        }

        const body = await request.json();
        const { transaction_id } = body;

        if (!transaction_id) {
            return NextResponse.json({ error: 'transaction_id is required' }, { status: 400 });
        }

        // Get the transaction
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

        if (transaction.status !== 'PENDING_BUYER_CONFIRMATION') {
            return NextResponse.json({
                error: 'Transaction is not pending buyer confirmation'
            }, { status: 400 });
        }

        // Check if buyer has sufficient balance
        const buyerWallet = await prisma.userWallet.findUnique({
            where: { user_id: transaction.buyer_id }
        });

        if (!buyerWallet) {
            return NextResponse.json({ error: 'Buyer wallet not found' }, { status: 404 });
        }

        const availableBalance = Number(buyerWallet.balance) - Number(buyerWallet.frozen_balance);
        const purchaseAmount = Number(transaction.amount);

        if (availableBalance < purchaseAmount) {
            return NextResponse.json({
                error: `Insufficient buyer balance. Available: $${availableBalance.toFixed(2)}, Required: $${purchaseAmount.toFixed(2)}`
            }, { status: 400 });
        }

        // Force complete the transaction
        const result = await prisma.$transaction(async (tx) => {
            // 1. Complete the transaction
            const completedTransaction = await tx.transaction.update({
                where: { id: transaction_id },
                data: {
                    status: 'COMPLETED',
                    transaction_type: 'ADMIN_FORCE_COMPLETED',
                    completed_at: new Date(),
                    notes: `Force completed by admin ${session.user.name} - Buyer failed to confirm within 24 hours`
                }
            });

            // 2. Transfer card ownership
            await tx.userCard.update({
                where: { id: transaction.user_card_id },
                data: {
                    is_sold: true,
                    is_for_sale: false,
                    owner_id: transaction.buyer_id,
                    notes: `Force completed by admin ${session.user.name}`
                }
            });

            // 3. Process wallet transactions
            const [currentBuyerWallet, currentSellerWallet] = await Promise.all([
                tx.userWallet.findUnique({ where: { user_id: transaction.buyer_id } }),
                tx.userWallet.findUnique({ where: { user_id: transaction.seller_id } })
            ]);

            if (!currentBuyerWallet || !currentSellerWallet) {
                throw new Error('Wallet not found');
            }

            // Update buyer wallet (deduct funds)
            const updatedBuyerWallet = await tx.userWallet.update({
                where: { user_id: transaction.buyer_id },
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
                        user_id: transaction.buyer_id,
                        transaction_type: 'PURCHASE',
                        amount: -purchaseAmount,
                        balance_before: Number(currentBuyerWallet.balance),
                        balance_after: Number(updatedBuyerWallet.balance),
                        description: `Force completed purchase: ${transaction.userCard.card.name} (Admin: ${session.user.name})`,
                        reference_id: transaction_id,
                        reference_type: 'TRANSACTION',
                        admin_id: parseInt(session.user.id)
                    }
                }),
                // Seller transaction
                tx.walletTransaction.create({
                    data: {
                        user_id: transaction.seller_id,
                        transaction_type: 'SALE',
                        amount: purchaseAmount,
                        balance_before: Number(currentSellerWallet.balance),
                        balance_after: Number(updatedSellerWallet.balance),
                        description: `Force completed sale: ${transaction.userCard.card.name} (Admin: ${session.user.name})`,
                        reference_id: transaction_id,
                        reference_type: 'TRANSACTION',
                        admin_id: parseInt(session.user.id)
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
                    to_user_id: transaction.buyer_id,
                    transaction_type: 'ADMIN_FORCE_COMPLETED',
                    price: purchaseAmount,
                    notes: `Force completed by admin ${session.user.name} - Original buyer failed to confirm`
                }
            });

            return {
                transaction: completedTransaction,
                card: transaction.userCard.card,
                amount: purchaseAmount
            };
        });

        // Create notifications
        try {
            await createPurchaseConfirmedNotifications(
                transaction.buyer_id,
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
            message: 'Transaction force completed successfully',
            transaction: {
                id: result.transaction.id,
                card_name: result.card.name,
                amount: result.amount,
                buyer_name: transaction.buyer.name,
                seller_name: transaction.seller.name,
                status: 'COMPLETED'
            }
        });

    } catch (error) {
        console.error('Error force completing transaction:', error);
        return NextResponse.json(
            {
                error: 'Failed to force complete transaction',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}