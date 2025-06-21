import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { prisma } from '../../lib/prisma';

// POST /api/process-auctions - Process all ended auctions
export async function POST() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const now = new Date();

        // Find all cards with ended auctions that haven't been processed
        const endedAuctions = await prisma.userCard.findMany({
            where: {
                sale_type: 'AUCTION',
                is_for_sale: true,
                is_sold: false,
                auction_end: {
                    lte: now
                }
            },
            include: {
                card: true,
                owner: {
                    select: { id: true, name: true, email: true }
                },
                bids: {
                    where: { is_active: true },
                    orderBy: { amount: 'desc' },
                    take: 1,
                    include: {
                        bidder: {
                            select: { id: true, name: true, email: true }
                        }
                    }
                }
            }
        });

        const processedAuctions = [];
        const failedAuctions = [];

        for (const auction of endedAuctions) {
            try {
                const highestBid = auction.bids[0];

                if (!highestBid) {
                    // No bids - just mark as not for sale
                    await prisma.userCard.update({
                        where: { id: auction.id },
                        data: {
                            is_for_sale: false,
                            sale_type: null,
                            auction_end: null,
                            reserve_price: null
                        }
                    });

                    processedAuctions.push({
                        auction_id: auction.id,
                        card_name: auction.card.name,
                        result: 'NO_BIDS',
                        final_price: 0
                    });
                    continue;
                }

                const winningBid = Number(highestBid.amount);
                const sellerId = auction.owner_id;
                const buyerId = highestBid.bidder_id;

                // Process the winning auction
                await prisma.$transaction(async (tx) => {
                    // Get seller's wallet or create one
                    let sellerWallet = await tx.userWallet.findUnique({
                        where: { user_id: sellerId }
                    });

                    if (!sellerWallet) {
                        sellerWallet = await tx.userWallet.create({
                            data: {
                                user_id: sellerId,
                                balance: 0.00,
                                frozen_balance: 0.00
                            }
                        });
                    }

                    // Get buyer's wallet
                    const buyerWallet = await tx.userWallet.findUnique({
                        where: { user_id: buyerId }
                    });

                    if (!buyerWallet) {
                        throw new Error('Buyer wallet not found');
                    }

                    // Transfer payment from frozen to seller
                    const newSellerBalance = Number(sellerWallet.balance) + winningBid;
                    const newBuyerFrozen = Number(buyerWallet.frozen_balance) - winningBid;

                    // Update seller's wallet
                    await tx.userWallet.update({
                        where: { user_id: sellerId },
                        data: { balance: newSellerBalance }
                    });

                    // Update buyer's wallet (unfreeze the bid amount)
                    await tx.userWallet.update({
                        where: { user_id: buyerId },
                        data: { frozen_balance: newBuyerFrozen }
                    });

                    // Transfer card ownership
                    await tx.userCard.update({
                        where: { id: auction.id },
                        data: {
                            owner_id: buyerId,
                            is_for_sale: false,
                            is_sold: true,
                            sale_type: null,
                            auction_end: null,
                            reserve_price: null
                        }
                    });

                    // Create transaction record
                    const transaction = await tx.transaction.create({
                        data: {
                            user_card_id: auction.id,
                            buyer_id: buyerId,
                            seller_id: sellerId,
                            amount: winningBid,
                            transaction_type: 'AUCTION_WIN',
                            status: 'COMPLETED',
                            completed_at: now,
                            notes: `Auction won with bid of ${winningBid.toFixed(2)}`
                        }
                    });

                    // Create wallet transaction records
                    await tx.walletTransaction.createMany({
                        data: [
                            // Buyer's payment (unfreeze)
                            {
                                user_id: buyerId,
                                transaction_type: 'AUCTION_PAYMENT',
                                amount: -winningBid,
                                balance_before: Number(buyerWallet.balance),
                                balance_after: Number(buyerWallet.balance),
                                description: `Won auction for ${auction.card.name}`,
                                reference_id: transaction.id,
                                reference_type: 'TRANSACTION'
                            },
                            // Seller's receipt
                            {
                                user_id: sellerId,
                                transaction_type: 'AUCTION_SALE',
                                amount: winningBid,
                                balance_before: Number(sellerWallet.balance),
                                balance_after: newSellerBalance,
                                description: `Sold ${auction.card.name} via auction`,
                                reference_id: transaction.id,
                                reference_type: 'TRANSACTION'
                            }
                        ]
                    });

                    // Create card history record
                    await tx.cardHistory.create({
                        data: {
                            user_card_id: auction.id,
                            from_user_id: sellerId,
                            to_user_id: buyerId,
                            transaction_type: 'AUCTION_WIN',
                            price: winningBid,
                            notes: `Auction completed. Winning bid: ${winningBid.toFixed(2)}`
                        }
                    });

                    // Deactivate all bids for this auction
                    await tx.bid.updateMany({
                        where: {
                            user_card_id: auction.id,
                            is_active: true
                        },
                        data: { is_active: false }
                    });

                    // Unfreeze funds for all other losing bidders
                    const losingBids = await tx.bid.findMany({
                        where: {
                            user_card_id: auction.id,
                            bidder_id: { not: buyerId },
                            is_active: false
                        }
                    });

                    for (const losingBid of losingBids) {
                        const loserWallet = await tx.userWallet.findUnique({
                            where: { user_id: losingBid.bidder_id }
                        });

                        if (loserWallet) {
                            await tx.userWallet.update({
                                where: { user_id: losingBid.bidder_id },
                                data: {
                                    frozen_balance: {
                                        decrement: Number(losingBid.amount)
                                    }
                                }
                            });

                            await tx.walletTransaction.create({
                                data: {
                                    user_id: losingBid.bidder_id,
                                    transaction_type: 'UNFREEZE_FUNDS',
                                    amount: Number(losingBid.amount),
                                    balance_before: Number(loserWallet.balance),
                                    balance_after: Number(loserWallet.balance),
                                    description: `Auction ended - bid refunded for ${auction.card.name}`,
                                    reference_id: losingBid.id,
                                    reference_type: 'AUCTION_REFUND'
                                }
                            });
                        }
                    }
                });

                processedAuctions.push({
                    auction_id: auction.id,
                    card_name: auction.card.name,
                    winner: highestBid.bidder.name,
                    winner_email: highestBid.bidder.email,
                    seller: auction.owner.name,
                    final_price: winningBid,
                    result: 'SOLD'
                });

            } catch (error) {
                console.error(`Failed to process auction ${auction.id}:`, error);
                failedAuctions.push({
                    auction_id: auction.id,
                    card_name: auction.card.name,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        return NextResponse.json({
            success: true,
            processed_count: processedAuctions.length,
            failed_count: failedAuctions.length,
            processed_auctions: processedAuctions,
            failed_auctions: failedAuctions,
            timestamp: now.toISOString()
        });

    } catch (error) {
        console.error('Error processing auctions:', error);
        return NextResponse.json(
            {
                error: 'Failed to process auctions',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

// GET /api/process-auctions - Get auctions that need processing
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const now = new Date();

        const endedAuctions = await prisma.userCard.findMany({
            where: {
                sale_type: 'AUCTION',
                is_for_sale: true,
                is_sold: false,
                auction_end: {
                    lte: now
                }
            },
            include: {
                card: {
                    select: { id: true, name: true, set_name: true, image_url: true }
                },
                owner: {
                    select: { id: true, name: true, email: true }
                },
                bids: {
                    where: { is_active: true },
                    orderBy: { amount: 'desc' },
                    take: 1,
                    include: {
                        bidder: {
                            select: { id: true, name: true, email: true }
                        }
                    }
                },
                _count: {
                    select: { bids: true }
                }
            }
        });

        return NextResponse.json({
            pending_auctions: endedAuctions.length,
            auctions: endedAuctions.map(auction => ({
                id: auction.id,
                card: auction.card,
                owner: auction.owner,
                auction_end: auction.auction_end,
                reserve_price: Number(auction.reserve_price) || 0,
                highest_bid: auction.bids[0] ? {
                    amount: Number(auction.bids[0].amount),
                    bidder: auction.bids[0].bidder
                } : null,
                total_bids: auction._count.bids,
                days_since_end: Math.floor((now.getTime() - auction.auction_end!.getTime()) / (1000 * 60 * 60 * 24))
            }))
        });

    } catch (error) {
        console.error('Error fetching pending auctions:', error);
        return NextResponse.json(
            { error: 'Failed to fetch pending auctions' },
            { status: 500 }
        );
    }
}