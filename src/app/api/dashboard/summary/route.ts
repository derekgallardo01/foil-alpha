import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '../../../lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        // Get general market stats
        const [
            totalCards,
            activeAuctions,
            recentSales,
            avgPrice,
            topGainers
        ] = await Promise.all([
            // Total cards in database
            prisma.card.count({
                where: { market_price: { not: null } }
            }),

            // Active auctions
            prisma.userCard.count({
                where: {
                    sale_type: 'AUCTION',
                    is_for_sale: true,
                    is_sold: false,
                    auction_end: { gte: new Date() }
                }
            }),

            // Recent sales (last 24 hours)
            prisma.transaction.count({
                where: {
                    status: 'COMPLETED',
                    created_at: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                    }
                }
            }),

            // Average card price
            prisma.card.aggregate({
                _avg: { market_price: true },
                where: { market_price: { not: null } }
            }),

            // Top gainers
            prisma.card.findMany({
                where: {
                    price_change_7d: { gt: 0 },
                    market_price: { not: null }
                },
                orderBy: { price_change_7d: 'desc' },
                take: 5,
                select: {
                    id: true,
                    name: true,
                    price_change_7d: true,
                    market_price: true
                }
            })
        ]);

        // User-specific stats if logged in
        let userStats = null;
        if (session?.user?.id) {
            const userId = parseInt(session.user.id);

            // Fetch user cards separately
            const userCards = await prisma.userCard.findMany({
                where: { owner_id: userId }
            });

            // Get card IDs
            const cardIds = userCards.map(uc => uc.card_id);

            // Fetch card details separately
            const cards = await prisma.card.findMany({
                where: { id: { in: cardIds } },
                select: {
                    id: true,
                    market_price: true
                }
            });

            // Create a map for quick lookup
            const cardPriceMap = new Map(
                cards.map(card => [card.id, card.market_price ? parseFloat(card.market_price.toString()) : 0])
            );

            // Calculate collection value
            const collectionValue = userCards.reduce((total, uc) => {
                const cardPrice = cardPriceMap.get(uc.card_id) || 0;
                return total + cardPrice;
            }, 0);

            const [
                activeBids,
                userTransactions,
                watchlistCount
            ] = await Promise.all([
                // Active bids
                prisma.bid.count({
                    where: {
                        bidderId: userId,
                        is_active: true
                    }
                }),

                // Recent transactions
                prisma.transaction.count({
                    where: {
                        OR: [
                            { buyer_id: userId },
                            { seller_id: userId }
                        ],
                        created_at: {
                            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                        }
                    }
                }),

                // Watchlist count
                prisma.watchlist.count({
                    where: { user_id: userId }
                })
            ]);

            userStats = {
                totalCards: userCards.length,
                collectionValue,
                activeBids,
                recentTransactions: userTransactions,
                watchlistCount
            };
        }

        return NextResponse.json({
            success: true,
            data: {
                market: {
                    totalCards,
                    activeAuctions,
                    recentSales,
                    avgPrice: avgPrice._avg.market_price ? parseFloat(avgPrice._avg.market_price.toString()) : 0,
                    topGainers: topGainers.map(card => ({
                        ...card,
                        price_change_7d: card.price_change_7d ? parseFloat(card.price_change_7d.toString()) : 0,
                        market_price: card.market_price ? parseFloat(card.market_price.toString()) : 0
                    }))
                },
                user: userStats
            }
        });

    } catch (error) {
        console.error('Error fetching dashboard summary:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch dashboard summary' },
            { status: 500 }
        );
    }
}