// src/app/api/admin/transactions/force-complete/route.ts - Force complete transaction
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requireAdmin } from '../../../../lib/auth';
import { createPurchaseConfirmedNotifications } from '../../../../lib/notification';
import { calculateCommission, recordCommissionTransaction } from '../../../../lib/commission-utils';
import { releaseBidHolds } from '../../../../lib/wallet-settlement';

export async function POST(request: NextRequest) {
    try {
        const auth = await requireAdmin();
        if ("response" in auth) return auth.response;
        const user = auth.user;

        const body = await request.json();
        const { transaction_id } = body;

        if (!transaction_id) {
            return NextResponse.json({ error: 'transaction_id is required' }, { status: 400 });
        }

        // Get the transaction (without problematic includes)
        const transaction = await prisma.transaction.findUnique({
            where: { id: transaction_id }
        });

        if (!transaction) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        // Get related data separately
        const userCard = await prisma.userCard.findUnique({
            where: { id: transaction.user_card_id }
        });

        if (!userCard) {
            return NextResponse.json({ error: 'Card not found' }, { status: 404 });
        }

        const card = await prisma.card.findUnique({
            where: { id: userCard.card_id }
        });

        const owner = await prisma.user.findUnique({
            where: { id: userCard.owner_id }
        });

        const buyer = await prisma.user.findUnique({
            where: { id: transaction.buyer_id }
        });

        const seller = await prisma.user.findUnique({
            where: { id: transaction.seller_id }
        });

        if (!card || !owner || !buyer || !seller) {
            return NextResponse.json({ error: 'Related data not found' }, { status: 404 });
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

        const purchaseAmount = Number(transaction.amount);

        // The winning bid is held in escrow (frozen), so the funds are already
        // reserved for this purchase — require the total balance to cover it.
        if (Number(buyerWallet.balance) < purchaseAmount) {
            return NextResponse.json({
                error: `Insufficient buyer balance. Balance: $${Number(buyerWallet.balance).toFixed(2)}, Required: $${purchaseAmount.toFixed(2)}`
            }, { status: 400 });
        }

        // Seller-funded commission (mirrors bids/confirm-purchase).
        const commission = await calculateCommission(purchaseAmount, card.rarity);
        const platformFee = Number(commission.commission_amount);
        const sellerReceives = purchaseAmount - platformFee;

        // Force complete the transaction
        const result = await prisma.$transaction(async (tx) => {
            // 1. Atomically CLAIM the transaction (PENDING->COMPLETED). Gates a
            //    double force-complete, or a force-complete racing the buyer's own
            //    confirm/decline, so settlement runs exactly once.
            const claimed = await tx.transaction.updateMany({
                where: { id: transaction_id, status: 'PENDING_BUYER_CONFIRMATION' },
                data: {
                    status: 'COMPLETED',
                    transaction_type: 'ADMIN_FORCE_COMPLETED',
                    notes: `Force completed by admin ${user.name} - Buyer failed to confirm within 24 hours`
                }
            });
            if (claimed.count !== 1) {
                throw new Error('This transaction has already been processed');
            }
            const completedTransaction = (await tx.transaction.findUnique({ where: { id: transaction_id } }))!;

            // 2. Transfer card ownership
            await tx.userCard.update({
                where: { id: transaction.user_card_id },
                data: {
                    is_sold: true,
                    is_for_sale: false,
                    owner_id: transaction.buyer_id,
                    notes: `Force completed by admin ${user.name}`
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

            // Update buyer wallet: deduct payment and release the escrow hold.
            const updatedBuyerWallet = await tx.userWallet.update({
                where: { user_id: transaction.buyer_id },
                data: {
                    balance: { decrement: purchaseAmount },
                    frozen_balance: { decrement: purchaseAmount }
                }
            });

            // Update seller wallet: net of the platform fee.
            const updatedSellerWallet = await tx.userWallet.update({
                where: { user_id: transaction.seller_id },
                data: {
                    balance: { increment: sellerReceives }
                }
            });

            // Credit the platform commission (updates admin_wallet + writes an
            // admin_wallet_transactions ledger row), and track the sale volume.
            if (platformFee > 0) {
                await recordCommissionTransaction({
                    transaction_type: 'COMMISSION',
                    amount: platformFee,
                    description: `Commission from force-completed ${card.name} sale`,
                    reference_type: 'TRANSACTION',
                    reference_id: transaction_id,
                    user_card_id: transaction.user_card_id,
                    buyer_id: transaction.buyer_id,
                    seller_id: transaction.seller_id,
                    card_id: card.id,
                    commission_rate: commission.commission_rate
                }, tx);
            }
            await tx.admin_wallet.updateMany({
                where: { wallet_type: 'PLATFORM' },
                data: { total_marketplace_sales: { increment: purchaseAmount } }
            });

            // Create wallet transaction records (add wallet_id)
            await Promise.all([
                // Buyer transaction
                tx.walletTransaction.create({
                    data: {
                        user_id: transaction.buyer_id,
                        wallet_id: currentBuyerWallet.id, // Add required wallet_id
                        transaction_type: 'PURCHASE',
                        amount: -purchaseAmount,
                        balance_before: Number(currentBuyerWallet.balance),
                        balance_after: Number(updatedBuyerWallet.balance),
                        description: `Force completed purchase: ${card.name} (Admin: ${user.name})`,
                        reference_id: transaction_id,
                        reference_type: 'TRANSACTION',
                        admin_id: user.id
                    }
                }),
                // Seller transaction
                tx.walletTransaction.create({
                    data: {
                        user_id: transaction.seller_id,
                        wallet_id: currentSellerWallet.id, // Add required wallet_id
                        transaction_type: 'SALE',
                        amount: sellerReceives,
                        balance_before: Number(currentSellerWallet.balance),
                        balance_after: Number(updatedSellerWallet.balance),
                        description: `Force completed sale: ${card.name} (platform fee $${platformFee.toFixed(2)}, Admin: ${user.name})`,
                        reference_id: transaction_id,
                        reference_type: 'TRANSACTION',
                        admin_id: user.id
                    }
                })
            ]);

            // 4. Release losing bidders' escrow, then deactivate all bids.
            await releaseBidHolds(tx, { auctionId: transaction.user_card_id, exceptBidderId: transaction.buyer_id });
            await tx.bid.updateMany({
                where: {
                    userCardId: transaction.user_card_id,
                    is_active: true
                },
                data: { is_active: false }
            });

            // 5. Create card history record (use cardTransactionHistory instead of cardHistory)
            await tx.cardTransactionHistory.create({
                data: {
                    userCardId: transaction.user_card_id,
                    fromUserId: transaction.seller_id,
                    toUserId: transaction.buyer_id,
                    action: 'ADMIN_FORCE_COMPLETED', // Use action instead of transaction_type
                    notes: `Force completed by admin ${user.name} - Original buyer failed to confirm`
                }
            });

            return {
                transaction: completedTransaction,
                card: card,
                amount: purchaseAmount
            };
        });

        // Create notifications
        try {
            await createPurchaseConfirmedNotifications(
                transaction.buyer_id,
                transaction.seller_id,
                card.name,
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
                buyer_name: buyer.name,
                seller_name: seller.name,
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