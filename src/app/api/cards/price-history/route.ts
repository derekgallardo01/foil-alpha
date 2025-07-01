// src/app/api/cards/price-history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const cardId = searchParams.get('card_id');
        const userCardId = searchParams.get('user_card_id');
        const days = parseInt(searchParams.get('days') || '30');
        const source = searchParams.get('source') || 'all';

        if (!cardId && !userCardId) {
            return NextResponse.json(
                { success: false, error: 'Either card_id or user_card_id is required' },
                { status: 400 }
            );
        }

        let targetCardId: number;
        let userCard = null;

        // Get card ID and user card info if needed
        if (userCardId) {
            userCard = await prisma.userCard.findUnique({
                where: { id: parseInt(userCardId) },
                select: {
                    id: true,
                    card_id: true,
                    owner_id: true,
                    is_for_sale: true,
                    sale_type: true,
                    fixed_price: true,
                    reserve_price: true,
                    created_at: true
                }
            });

            if (!userCard) {
                return NextResponse.json(
                    { success: false, error: 'User card not found' },
                    { status: 404 }
                );
            }

            targetCardId = userCard.card_id;
        } else {
            targetCardId = parseInt(cardId!);
        }

        // Validate card exists
        const card = await prisma.card.findUnique({
            where: { id: targetCardId },
            select: {
                id: true,
                name: true,
                set_name: true,
                market_price: true,
                price_trend: true,
                last_price_update: true,
            }
        });

        if (!card) {
            return NextResponse.json(
                { success: false, error: 'Card not found' },
                { status: 404 }
            );
        }

        // Calculate date range
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Build source filter
        const sourceFilter = source === 'all' ? {} : { source };

        // Get market price history using the correct table name
        const marketPriceHistory = await prisma.price_history.findMany({
            where: {
                card_id: targetCardId,
                recorded_at: { gte: startDate },
                ...sourceFilter,
            },
            orderBy: { recorded_at: 'asc' },
            select: {
                price: true,
                recorded_at: true,
                source: true,
                metadata: true,
            }
        });

        // Get user price history if user card provided
        let userPriceHistory: Array<{ price: number; recorded_at: Date; type: string }> = [];

        if (userCard && userCard.is_for_sale) {
            // Current user listing price
            const currentUserPrice = userCard.sale_type === 'FIXED'
                ? userCard.fixed_price
                : userCard.reserve_price;

            if (currentUserPrice) {
                userPriceHistory.push({
                    price: parseFloat(currentUserPrice.toString()),
                    recorded_at: userCard.created_at,
                    type: userCard.sale_type === 'FIXED' ? 'fixed_price' : 'reserve_price'
                });
            }

            // Bid history for auctions (shows market demand)
            if (userCard.sale_type === 'AUCTION') {
                const bidHistory = await prisma.bid.findMany({
                    where: {
                        userCardId: userCard.id,
                        is_active: true,
                        createdAt: { gte: startDate }
                    },
                    orderBy: { createdAt: 'asc' },
                    select: {
                        amount: true,
                        createdAt: true,
                    }
                });

                userPriceHistory.push(...bidHistory.map(bid => ({
                    price: parseFloat(bid.amount.toString()),
                    recorded_at: bid.createdAt,
                    type: 'bid'
                })));
            }
        }

        // Combine and format chart data
        const chartDataMap = new Map<string, any>();

        // Add market prices grouped by date
        marketPriceHistory.forEach(entry => {
            const dateKey = entry.recorded_at.toISOString().split('T')[0]; // YYYY-MM-DD

            if (!chartDataMap.has(dateKey)) {
                chartDataMap.set(dateKey, {
                    date: dateKey,
                    market_price: null,
                    user_price: null,
                });
            }

            const data = chartDataMap.get(dateKey)!;
            const price = parseFloat(entry.price.toString());

            // Use the latest price for each day (could be improved to use daily close)
            data.market_price = price;
        });

        // Add user prices
        userPriceHistory.forEach(entry => {
            const dateKey = entry.recorded_at.toISOString().split('T')[0];

            if (!chartDataMap.has(dateKey)) {
                chartDataMap.set(dateKey, {
                    date: dateKey,
                    market_price: null,
                    user_price: null,
                });
            }

            const data = chartDataMap.get(dateKey)!;
            data.user_price = entry.price;
            data.user_price_type = entry.type;
        });

        // Convert to array and sort by date
        const chartData = Array.from(chartDataMap.values())
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Calculate analytics for market prices only
        const marketPrices = chartData
            .map(d => d.market_price)
            .filter(p => p !== null) as number[];

        const analytics = {
            price_stats: marketPrices.length > 0 ? {
                current: marketPrices[marketPrices.length - 1] || 0,
                highest: Math.max(...marketPrices),
                lowest: Math.min(...marketPrices),
                average: marketPrices.reduce((a, b) => a + b, 0) / marketPrices.length,
            } : null,
            trend_analysis: marketPrices.length > 1 ? {
                trend: marketPrices[marketPrices.length - 1] > marketPrices[0] ? 'up' :
                    marketPrices[marketPrices.length - 1] < marketPrices[0] ? 'down' : 'stable',
                change_percentage: marketPrices[0] > 0 ?
                    ((marketPrices[marketPrices.length - 1] - marketPrices[0]) / marketPrices[0]) * 100 : 0,
                volatility: calculateVolatility(marketPrices),
            } : { trend: 'stable', change_percentage: 0, volatility: 0 },
        };

        // Price comparison if user has listing
        let priceComparison = null;
        if (userCard && userCard.is_for_sale && card.market_price) {
            const userPrice = userCard.sale_type === 'FIXED'
                ? userCard.fixed_price
                : userCard.reserve_price;

            if (userPrice) {
                const marketPrice = parseFloat(card.market_price.toString());
                const userPriceNum = parseFloat(userPrice.toString());
                const difference = userPriceNum - marketPrice;
                const percentageDiff = (difference / marketPrice) * 100;

                priceComparison = {
                    user_price: userPriceNum,
                    market_price: marketPrice,
                    difference,
                    percentage_difference: percentageDiff,
                    is_above_market: difference > 0,
                    recommendation: percentageDiff > 10 ? 'Consider lowering price' :
                        percentageDiff < -10 ? 'Great deal for buyers' :
                            'Competitively priced'
                };
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                card_info: {
                    id: card.id,
                    name: card.name,
                    set_name: card.set_name,
                    current_price: card.market_price ? parseFloat(card.market_price.toString()) : null,
                    price_trend: card.price_trend,
                    last_update: card.last_price_update,
                    user_resell_price: userCard ? (
                        userCard.sale_type === 'FIXED'
                            ? (userCard.fixed_price ? parseFloat(userCard.fixed_price.toString()) : null)
                            : (userCard.reserve_price ? parseFloat(userCard.reserve_price.toString()) : null)
                    ) : null,
                },
                chart_data: chartData,
                analytics,
                price_comparison: priceComparison,
                period: `${days} days`,
                has_user_data: userPriceHistory.length > 0,
                data_points: {
                    market_prices: marketPrices.length,
                    user_prices: userPriceHistory.length,
                    total_entries: marketPriceHistory.length,
                }
            }
        });

    } catch (error) {
        console.error('Error fetching card price history:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch price history',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

// Helper function to calculate price volatility
function calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;

    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
    const standardDeviation = Math.sqrt(variance);

    return (standardDeviation / mean) * 100; // As percentage
}