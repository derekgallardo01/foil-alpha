import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const period = searchParams.get('period') || '7d';
        const limit = parseInt(searchParams.get('limit') || '10');

        // Calculate date range
        const daysMap: Record<string, number> = {
            '24h': 1,
            '7d': 7,
            '30d': 30,
        };
        const days = daysMap[period] || 7;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get most viewed cards
        const popularCards = await prisma.card.findMany({
            where: {
                view_count: { gt: 0 },
                market_price: { not: null }
            },
            orderBy: {
                view_count: 'desc'
            },
            take: limit,
            select: {
                id: true,
                name: true,
                set_name: true,
                rarity: true,
                image_url: true, // FIXED: Changed from image_small to image_url (matching schema)
                market_price: true,
                view_count: true,
            }
        });

        // Get price history for price change calculation
        const cardIds = popularCards.map(card => card.id);
        const priceHistory = await prisma.price_history.findMany({
            where: {
                card_id: { in: cardIds },
                recorded_at: { gte: startDate }
            },
            orderBy: {
                recorded_at: 'asc'
            }
        });

        // Calculate price changes from history
        const priceChangeMap = new Map<number, number>();
        const cardPriceHistory = new Map<number, Array<{ price: number, recorded_at: Date }>>();

        // Group price history by card
        priceHistory.forEach(ph => {
            const cardHistory = cardPriceHistory.get(ph.card_id) || [];
            cardHistory.push({
                price: parseFloat(ph.price.toString()),
                recorded_at: ph.recorded_at
            });
            cardPriceHistory.set(ph.card_id, cardHistory);
        });

        // Calculate price change for each card
        cardPriceHistory.forEach((history, cardId) => {
            if (history.length >= 2) {
                const oldestPrice = history[0].price;
                const newestPrice = history[history.length - 1].price;
                const percentChange = oldestPrice > 0 ?
                    ((newestPrice - oldestPrice) / oldestPrice) * 100 : 0;
                priceChangeMap.set(cardId, percentChange);
            }
        });

        // Get active listing counts
        const listingCounts = await prisma.userCard.groupBy({
            by: ['card_id'],
            where: {
                card_id: { in: cardIds },
                is_for_sale: true,
                is_sold: false
            },
            _count: {
                id: true
            }
        });

        // Get recent sale counts
        const recentSales = await prisma.userCard.groupBy({
            by: ['card_id'],
            where: {
                card_id: { in: cardIds },
                is_sold: true,
                created_at: { gte: startDate }
            },
            _count: {
                id: true
            }
        });

        // Create lookup maps
        const listingMap = new Map(listingCounts.map(l => [l.card_id, l._count.id]));
        const salesMap = new Map(recentSales.map(s => [s.card_id, s._count.id]));

        // Format response
        const formattedCards = popularCards.map(card => ({
            id: card.id,
            name: card.name,
            set_name: card.set_name,
            rarity: card.rarity,
            image_url: card.image_url, // FIXED: Use image_url directly from schema
            market_price: card.market_price ? parseFloat(card.market_price.toString()) : null,
            price_change_7d: priceChangeMap.get(card.id) || null, // Use calculated price change
            view_count: card.view_count,
            active_listings: listingMap.get(card.id) || 0,
            recent_sales: salesMap.get(card.id) || 0,
            popularity_score: calculatePopularityScore(
                card.view_count,
                listingMap.get(card.id) || 0,
                salesMap.get(card.id) || 0
            )
        }));

        return NextResponse.json({
            success: true,
            data: formattedCards,
            period
        });

    } catch (error) {
        console.error('Error fetching popular cards:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch popular cards' },
            { status: 500 }
        );
    }
}

function calculatePopularityScore(views: number, listings: number, sales: number): number {
    // Weighted score: views (40%), active listings (30%), recent sales (30%)
    return Math.round((views * 0.4) + (listings * 30) + (sales * 50));
}