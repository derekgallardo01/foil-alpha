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
            last_updated: { gte: startDate } // Changed from last_price_update to last_updated
        };

        // Get base cards with different ordering based on type
        switch (type) {
            case 'price':
                // We'll calculate price changes after fetching
                orderBy = { market_price: 'desc' };
                break;

            case 'volume':
                // For volume, we'll use view_count as a proxy since volume_24h doesn't exist
                orderBy = { view_count: 'desc' };
                where.view_count = { gt: 0 };
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
            take: limit * 3, // Get more cards to filter after calculating price changes
            select: {
                id: true,
                name: true,
                set_name: true,
                rarity: true,
                image_url: true, // Changed from image_url to image_small
                market_price: true,
                view_count: true,
                last_updated: true, // Changed from last_price_update
            }
        });

        const cardIds = trendingCards.map(card => card.id);

        // Get price history for price change calculation and sparklines
        const priceHistory = await prisma.price_history.findMany({
            where: {
                card_id: { in: cardIds },
                recorded_at: { gte: startDate }
            },
            orderBy: {
                recorded_at: 'asc'
            }
        });

        // Calculate price changes and volume (transaction count as proxy)
        const cardPriceChanges = new Map<number, number>();
        const cardVolumes = new Map<number, number>();
        const cardSparklines = new Map<number, Array<{ date: Date, price: number }>>();

        // Group price history by card
        const cardHistoryMap = new Map<number, Array<{ price: number, recorded_at: Date }>>();
        priceHistory.forEach(ph => {
            const cardHistory = cardHistoryMap.get(ph.card_id) || [];
            cardHistory.push({
                price: parseFloat(ph.price.toString()),
                recorded_at: ph.recorded_at
            });
            cardHistoryMap.set(ph.card_id, cardHistory);
        });

        // Calculate price changes and create sparklines
        cardHistoryMap.forEach((history, cardId) => {
            // Create sparkline data
            cardSparklines.set(cardId, history.map(h => ({
                date: h.recorded_at,
                price: h.price
            })));

            // Calculate price change
            if (history.length >= 2) {
                const oldestPrice = history[0].price;
                const newestPrice = history[history.length - 1].price;
                const percentChange = oldestPrice > 0 ?
                    ((newestPrice - oldestPrice) / oldestPrice) * 100 : 0;
                cardPriceChanges.set(cardId, percentChange);
            }

            // Use number of price records as volume proxy
            cardVolumes.set(cardId, history.length);
        });

        // Get transaction counts as additional volume metric
        const transactionCounts = await prisma.transaction.groupBy({
            by: ['user_card_id'],
            where: {
                created_at: { gte: startDate },
                status: 'COMPLETED'
            },
            _count: { id: true }
        });

        // Get user_card to card mappings for transaction volumes
        const userCardTransactions = await prisma.userCard.findMany({
            where: {
                card_id: { in: cardIds }
            },
            select: {
                id: true,
                card_id: true
            }
        });

        // Map transaction counts to cards
        const userCardToCard = new Map(userCardTransactions.map(uc => [uc.id, uc.card_id]));
        transactionCounts.forEach(tc => {
            const cardId = userCardToCard.get(tc.user_card_id);
            if (cardId) {
                const currentVolume = cardVolumes.get(cardId) || 0;
                cardVolumes.set(cardId, currentVolume + tc._count.id);
            }
        });

        // Format response and apply proper sorting based on type
        let formattedCards = trendingCards.map(card => ({
            id: card.id,
            name: card.name,
            set_name: card.set_name,
            rarity: card.rarity,
            image_url: card.image_url, // Map to expected API field name
            market_price: card.market_price ? parseFloat(card.market_price.toString()) : null,
            price_change_7d: cardPriceChanges.get(card.id) || 0,
            volume_24h: cardVolumes.get(card.id) || 0,
            view_count: card.view_count,
            last_price_update: card.last_updated,
            sparkline: cardSparklines.get(card.id) || []
        }));

        // Apply proper sorting based on calculated values
        if (type === 'price') {
            formattedCards = formattedCards
                .filter(card => Math.abs(card.price_change_7d) > 0.1) // Only cards with meaningful price changes
                .sort((a, b) => b.price_change_7d - a.price_change_7d);
        } else if (type === 'volume') {
            formattedCards = formattedCards
                .filter(card => card.volume_24h > 0)
                .sort((a, b) => b.volume_24h - a.volume_24h);
        }
        // For popularity, it's already sorted by view_count

        // Limit final results
        formattedCards = formattedCards.slice(0, limit);

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