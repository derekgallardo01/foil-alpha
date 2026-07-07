// src/app/api/cron/expired-transactions/route.ts - Handle expired pending transactions
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { createPurchaseExpiredNotifications } from '../../../lib/notification';

export async function POST(request: NextRequest) {
    try {
        // Verify this is a legitimate cron request (you should add authentication)
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('Starting expired transactions cleanup...');

        // Find all pending transactions that have expired (older than 24 hours)
        const expiredTransactions = await prisma.transaction.findMany({
            where: {
                status: 'PENDING_BUYER_CONFIRMATION',
                created_at: {
                    lt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
                }
            }
        });

        console.log(`Found ${expiredTransactions.length} expired transactions`);

        if (expiredTransactions.length === 0) {
            return NextResponse.json({
                message: 'No expired transactions found',
                processed: 0
            });
        }

        let processedCount = 0;
        const results = [];

        for (const transaction of expiredTransactions) {
            try {
                // Get related data
                const [userCard, card, buyer, seller] = await Promise.all([
                    prisma.userCard.findUnique({ where: { id: transaction.user_card_id } }),
                    prisma.card.findFirst({
                        where: {
                            id: {
                                in: await prisma.userCard.findUnique({
                                    where: { id: transaction.user_card_id },
                                    select: { card_id: true }
                                }).then(uc => uc ? [uc.card_id] : [])
                            }
                        }
                    }),
                    prisma.user.findUnique({ where: { id: transaction.buyer_id } }),
                    prisma.user.findUnique({ where: { id: transaction.seller_id } })
                ]);

                if (!userCard || !card || !buyer || !seller) {
                    console.error(`Missing data for transaction ${transaction.id}`);
                    continue;
                }

                // Process the expired transaction
                const settled = await prisma.$transaction(async (tx) => {
                    // 1. Atomically CLAIM the transaction (PENDING->EXPIRED). Gates a
                    //    race with force-complete or the process-auctions expiry loop
                    //    (both act on the same expired-PENDING population), so it
                    //    settles exactly once.
                    const claimed = await tx.transaction.updateMany({
                        where: { id: transaction.id, status: 'PENDING_BUYER_CONFIRMATION' },
                        data: {
                            status: 'EXPIRED',
                            transaction_type: 'BID_PURCHASE_EXPIRED',
                            notes: 'Purchase confirmation window expired (24 hours)'
                        }
                    });
                    if (claimed.count !== 1) return false; // already settled elsewhere

                    // 2. Release the expired winner's escrow hold + drop their bid.
                    //    (Do NOT reactivate history: the remaining bidders' bids stay
                    //    active with their holds, so the auction just continues.)
                    await tx.userWallet.updateMany({
                        where: { user_id: transaction.buyer_id },
                        data: { frozen_balance: { decrement: Number(transaction.amount) } }
                    });
                    await tx.bid.updateMany({
                        where: {
                            userCardId: transaction.user_card_id,
                            bidderId: transaction.buyer_id,
                            is_active: true
                        },
                        data: { is_active: false }
                    });

                    // 3. Relist the card for auction.
                    await tx.userCard.update({
                        where: { id: transaction.user_card_id },
                        data: {
                            is_for_sale: true,
                            is_sold: false,
                            notes: null // Clear pending notes
                        }
                    });

                    // 4. Create transaction history
                    await tx.cardTransactionHistory.create({
                        data: {
                            userCardId: transaction.user_card_id,
                            fromUserId: transaction.seller_id,
                            toUserId: transaction.buyer_id,
                            action: 'BID_PURCHASE_EXPIRED',
                            notes: `Purchase confirmation expired for ${Number(transaction.amount).toFixed(2)}`
                        }
                    });
                    return true;
                });

                if (!settled) continue; // another path already settled this one

                // 5. Create expiration notifications (outside transaction for better error handling)
                try {
                    await createPurchaseExpiredNotifications(
                        transaction.buyer_id,
                        transaction.seller_id,
                        card.name,
                        Number(transaction.amount),
                        transaction.user_card_id
                    );
                } catch (notificationError) {
                    console.error(`Failed to create notifications for transaction ${transaction.id}:`, notificationError);
                }

                processedCount++;
                results.push({
                    transaction_id: transaction.id,
                    card_name: card.name,
                    buyer_name: buyer.name,
                    seller_name: seller.name,
                    amount: Number(transaction.amount),
                    status: 'expired'
                });

                console.log(`Processed expired transaction ${transaction.id} for ${card.name}`);

            } catch (error) {
                console.error(`Error processing transaction ${transaction.id}:`, error);
                results.push({
                    transaction_id: transaction.id,
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        console.log(`Completed expired transactions cleanup. Processed: ${processedCount}/${expiredTransactions.length}`);

        return NextResponse.json({
            message: `Processed ${processedCount} expired transactions`,
            processed: processedCount,
            total_found: expiredTransactions.length,
            results
        });

    } catch (error) {
        console.error('Error in expired transactions cron:', error);
        return NextResponse.json(
            {
                error: 'Failed to process expired transactions',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

// GET method for manual testing
export async function GET() {
    return NextResponse.json({
        message: 'Expired transactions cron endpoint',
        usage: 'POST with proper authorization to process expired transactions'
    });
}