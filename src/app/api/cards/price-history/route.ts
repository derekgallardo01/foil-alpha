// src/app/api/cards/price-history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

interface PriceHistoryEntry {
    id: number;
    card_id: number;
    price: number;
    source: string;
    recorded_at: string;
    metadata?: any;
}

interface PriceHistoryResponse {
    card_info: {
        id: number;
        name: string;
        set_name: string;
        current_price: number | null;
        user_resell_price?: number | null;
    };
    price_history: PriceHistoryEntry[];
    analytics: {
        total_entries: number;
        date_range: {
            start: string;
            end: string;
        };
        price_stats: {
            current: number;
            highest: number;
            lowest: number;
            average: number;
        };
        trend_analysis: {
            trend: 'up' | 'down' | 'stable';
            change_percentage: number;
            volatility: number;
        };
    };
    chart_data: Array<{
        date: string;
        market_price: number;
        user_price?: number;
    }>;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const cardId = searchParams.get('card_id');
        const userCardId = searchParams.get('user_card_id');
        const days = parseInt(searchParams.get('days') || '30');
        const source = searchParams.get('source'); // 'pokemon_price_tracker', 'user_resell', 'all'

        if (!cardId && !userCardId) {
            return NextResponse.json(
                { success: false, error: 'Either card_id or user_card_id must be provided' },
                { status: 400 }
            );
        }

        let targetCardId: number;
        let userResellPrices: any[] = [];

        // Get card info and determine target card ID
        if (userCardId) {
            const userCard = await prisma.userCard.findUnique({
                where: { id: parseInt(userCardId) },
                include: {
                    card: {
                        select: {
                            id: true,
                            name: true,
                            set_name: true,
                            market_price: true,
                        }
                    }
                }
            });

            if (!userCard) {
                return NextResponse.json(
                    { success: false, error: 'User card not found' },
                    { status: 404 }
                );
            }

            targetCardId = userCard.card.id;

            // Get user resell price history (when they change their listing price)
            userResellPrices = await prisma.$queryRaw`
        SELECT 
          'user_resell' as source,
          fixed_price as price,
          updated_at as recorded_at,
          'User resell price' as metadata
        FROM user_cards 
        WHERE id = ${parseInt(userCardId)} AND fixed_price IS NOT NULL
        UNION ALL
        SELECT 
          'user_resell' as source,
          reserve_price as price,
          updated_at as recorded_at,
          'User auction reserve' as metadata
        FROM user_cards 
        WHERE id = ${parseInt(userCardId)} AND reserve_price IS NOT NULL
        ORDER BY recorded_at DESC
      ` as any[];

        } else {
            targetCardId = parseInt(cardId!);
        }

        // Get card information
        const card = await prisma.card.findUnique({
            where: { id: targetCardId },
            select: {
                id: true,
                name: true,
                set_name: true,
                market_price: true,
            }
        });

        if (!card) {
            return NextResponse.json(
                { success: false, error: 'Card not found' },
                { status: 404 }
            );
        }

        // Build price history query
        let priceHistoryQuery = `
      SELECT 
        id,
        card_id,
        price,
        source,
        recorded_at,
        metadata
      FROM price_history 
      WHERE card_id = ? 
    `;

        const queryParams: any[] = [targetCardId];

        // Add date filter
        if (days > 0) {
            priceHistoryQuery += ` AND recorded_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`;
            queryParams.push(days);
        }

        // Add source filter
        if (source && source !== 'all') {
            priceHistoryQuery += ` AND source = ?`;
            queryParams.push(source);
        }

        priceHistoryQuery += ` ORDER BY recorded_at DESC LIMIT 1000`;

        // Execute the query
        const priceHistory = await prisma.$queryRawUnsafe(priceHistoryQuery, ...queryParams) as PriceHistoryEntry[];

        // Combine market price history with user resell prices
        const allPriceHistory = [...priceHistory];
        if (userResellPrices.length > 0) {
            allPriceHistory.push(...userResellPrices.map((entry: any) => ({
                id: 0,
                card_id: targetCardId,
                price: Number(entry.price),
                source: entry.source,
                recorded_at: entry.recorded_at.toISOString(),
                metadata: entry.metadata
            })));
        }

        // Sort combined history by date
        allPriceHistory.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());

        // Calculate analytics
        const prices = allPriceHistory.map(entry => Number(entry.price)).filter(p => p > 0);
        const marketPrices = priceHistory.map(entry => Number(entry.price)).filter(p => p > 0);

        let analytics = {
            total_entries: allPriceHistory.length,
            date_range: {
                start: allPriceHistory.length > 0 ? allPriceHistory[allPriceHistory.length - 1].recorded_at : '',
                end: allPriceHistory.length > 0 ? allPriceHistory[0].recorded_at : ''
            },
            price_stats: {
                current: Number(card.market_price) || 0,
                highest: prices.length > 0 ? Math.max(...prices) : 0,
                lowest: prices.length > 0 ? Math.min(...prices) : 0,
                average: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0
            },
            trend_analysis: {
                trend: 'stable' as 'up' | 'down' | 'stable',
                change_percentage: 0,
                volatility: 0
            }
        };

        // Calculate trend analysis
        if (marketPrices.length >= 2) {
            const recent = marketPrices.slice(0, Math.min(5, marketPrices.length));
            const older = marketPrices.slice(-Math.min(5, marketPrices.length));

            const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
            const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

            if (olderAvg > 0) {
                analytics.trend_analysis.change_percentage = ((recentAvg - olderAvg) / olderAvg) * 100;

                if (analytics.trend_analysis.change_percentage > 5) {
                    analytics.trend_analysis.trend = 'up';
                } else if (analytics.trend_analysis.change_percentage < -5) {
                    analytics.trend_analysis.trend = 'down';
                } else {
                    analytics.trend_analysis.trend = 'stable';
                }
            }

            // Calculate volatility (standard deviation of price changes)
            if (prices.length > 1) {
                const changes = [];
                for (let i = 1; i < prices.length; i++) {
                    const change = Math.abs(prices[i] - prices[i - 1]) / prices[i - 1];
                    changes.push(change);
                }
                const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
                const variance = changes.reduce((a, b) => a + Math.pow(b - avgChange, 2), 0) / changes.length;
                analytics.trend_analysis.volatility = Math.sqrt(variance) * 100;
            }
        }

        // Prepare chart data (group by day for better visualization)
        const chartDataMap = new Map<string, { market_price: number | null; user_price: number | null }>();

        allPriceHistory.forEach(entry => {
            const date = new Date(entry.recorded_at).toISOString().split('T')[0];
            const existing = chartDataMap.get(date) || { market_price: null, user_price: null };

            if (entry.source === 'pokemon_price_tracker' || entry.source === 'tcgplayer') {
                existing.market_price = Number(entry.price);
            } else if (entry.source === 'user_resell') {
                existing.user_price = Number(entry.price);
            }

            chartDataMap.set(date, existing);
        });

        const chartData = Array.from(chartDataMap.entries())
            .map(([date, prices]) => ({
                date,
                market_price: prices.market_price || 0,
                user_price: prices.user_price || undefined
            }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const response: PriceHistoryResponse = {
            card_info: {
                id: card.id,
                name: card.name,
                set_name: card.set_name,
                current_price: card.market_price ? Number(card.market_price) : null,
                user_resell_price: userResellPrices.length > 0 ? Number(userResellPrices[0].price) : undefined
            },
            price_history: allPriceHistory,
            analytics,
            chart_data: chartData
        };

        return NextResponse.json({
            success: true,
            data: response
        });

    } catch (error) {
        console.error('Error fetching price history:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch price history',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

// POST endpoint to manually add price history entry
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            card_id,
            price,
            source = 'manual',
            metadata = {}
        } = body;

        if (!card_id || !price) {
            return NextResponse.json(
                { success: false, error: 'card_id and price are required' },
                { status: 400 }
            );
        }

        // Verify card exists
        const card = await prisma.card.findUnique({
            where: { id: parseInt(card_id) }
        });

        if (!card) {
            return NextResponse.json(
                { success: false, error: 'Card not found' },
                { status: 404 }
            );
        }

        // Add price history entry
        const priceEntry = await prisma.$executeRaw`
      INSERT INTO price_history (card_id, price, source, recorded_at, metadata)
      VALUES (${parseInt(card_id)}, ${parseFloat(price)}, ${source}, NOW(), ${JSON.stringify(metadata)})
    `;

        return NextResponse.json({
            success: true,
            message: 'Price history entry added successfully',
            entry_id: priceEntry
        });

    } catch (error) {
        console.error('Error adding price history entry:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to add price history entry',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}