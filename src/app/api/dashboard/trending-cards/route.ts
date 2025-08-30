import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const period = searchParams.get('period') || '7d';
        const limit = parseInt(searchParams.get('limit') || '10');
        const type = searchParams.get('type') || 'price'; // 'price', 'volume', 'popularity'

        // Calculate date range
        const daysMap: Record<string, number> = {
            '24h': 1,
            '7d': 7,
            '30d': 30,
        };
        const days = daysMap[period] || 7;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        let orderBy: any = {};
        let where: any = {
            market_price: { not: null },
            last_price_update: { gte: startDate }
        };

        switch (type) {
            case 'price':
                // Trending by price change
                orderBy = { price_change_7d: 'desc' };
                where.price_change_7d = { not: null };
                break;

            case 'volume':
                // Trending by trading volume
                orderBy = { volume_24h: 'desc' };
                where.volume_24h = { gt: 0 };
                break;

            case 'popularity':
                // Trending by view count
                orderBy = { view_count: 'desc' };
                break;
        }

        // Get trending cards
        const trendingCards = await prisma.card.findMany({
            where,
            orderBy,
            take: limit,
            select: {
                id: true,
                name: true,
                set_name: true,
                rarity: true,
                image_url: true,
                market_price: true,
                price_change_7d: true,
                volume_24h: true,
                view_count: true,
                last_price_update: true,
            }
        });

        // Get price history for sparklines
        const cardIds = trendingCards.map(card => card.id);
        const priceHistories = await prisma.price_history.groupBy({
            by: ['card_id', 'recorded_at'],
            where: {
                card_id: { in: cardIds },
                recorded_at: { gte: startDate }
            },
            _avg: {
                price: true
            },
            orderBy: {
                recorded_at: 'asc'
            }
        });

        // Format response with sparkline data
        const formattedCards = trendingCards.map(card => {
            const cardHistory = priceHistories
                .filter(h => h.card_id === card.id)
                .map(h => ({
                    date: h.recorded_at,
                    price: h._avg.price || 0
                }));

            return {
                ...card,
                market_price: card.market_price ? parseFloat(card.market_price.toString()) : null,
                price_change_7d: card.price_change_7d ? parseFloat(card.price_change_7d.toString()) : null,
                volume_24h: card.volume_24h ? parseFloat(card.volume_24h.toString()) : null,
                sparkline: cardHistory
            };
        });

        return NextResponse.json({
            success: true,
            data: formattedCards,
            period,
            type
        });

    } catch (error) {
        console.error('Error fetching trending cards:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch trending cards' },
            { status: 500 }
        );
    }
}