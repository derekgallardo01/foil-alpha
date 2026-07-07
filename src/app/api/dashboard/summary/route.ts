import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const user = await getAuthUser();

        // Calculate date for 7 days ago for price change calculation
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Get general market stats
        const [
            totalCards,
            activeAuctions,
            recentSales,
            avgPrice
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
            })
        ]);

        // Get top cards with recent price history for gainers calculation
        const cardsWithPrices = await prisma.card.findMany({
            where: {
                market_price: { not: null, gt: 0 }
            },
            orderBy: { market_price: 'desc' },
            take: 50, // Get top 50 by current price to find gainers from
            select: {
                id: true,
                name: true,
                market_price: true
            }
        });

        // Get price history for these cards to calculate price changes
        const cardIds = cardsWithPrices.map(c => c.id);
        const priceHistory = await prisma.price_history.findMany({
            where: {
                card_id: { in: cardIds },
                recorded_at: { gte: sevenDaysAgo }
            },
            orderBy: {
                recorded_at: 'asc'
            }
        });

        // Calculate price changes
        const cardPriceChanges = new Map<number, number>();
        const cardHistoryMap = new Map<number, Array<{ price: number, recorded_at: Date }>>();

        // Group price history by card
        priceHistory.forEach(ph => {
            const cardHistory = cardHistoryMap.get(ph.card_id) || [];
            cardHistory.push({
                price: parseFloat(ph.price.toString()),
                recorded_at: ph.recorded_at
            });
            cardHistoryMap.set(ph.card_id, cardHistory);
        });

        // Calculate percentage change for each card
        cardHistoryMap.forEach((history, cardId) => {
            if (history.length >= 2) {
                const oldestPrice = history[0].price;
                const newestPrice = history[history.length - 1].price;
                const percentChange = oldestPrice > 0 ?
                    ((newestPrice - oldestPrice) / oldestPrice) * 100 : 0;
                cardPriceChanges.set(cardId, percentChange);
            }
        });

        // Find top gainers
        const topGainers = cardsWithPrices
            .map(card => ({
                id: card.id,
                name: card.name,
                market_price: card.market_price,
                price_change_7d: cardPriceChanges.get(card.id) || 0
            }))
            .filter(card => card.price_change_7d > 0)
            .sort((a, b) => b.price_change_7d - a.price_change_7d)
            .slice(0, 5);

        // User-specific stats if logged in
        let userStats = null;
        if (user) {
            const userId = user.id;

            // Fetch user cards separately
            const userCards = await prisma.userCard.findMany({
                where: { owner_id: userId }
            });

            // Get card IDs
            const userCardIds = userCards.map(uc => uc.card_id);

            // Fetch card details separately
            const cards = await prisma.card.findMany({
                where: { id: { in: userCardIds } },
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
                        id: card.id,
                        name: card.name,
                        price_change_7d: card.price_change_7d,
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