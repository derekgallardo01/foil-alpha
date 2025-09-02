import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '10');
        const type = searchParams.get('type') || 'recent'; // 'recent', 'upcoming', 'preorder'

        const now = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let where: any = {};

        switch (type) {
            case 'recent':
                // Recently released sets (last 30 days)
                where = {
                    release_date: {
                        gte: thirtyDaysAgo.toISOString().split('T')[0],
                        lte: now.toISOString().split('T')[0]
                    }
                };
                break;

            case 'upcoming':
                // Upcoming releases
                where = {
                    release_date: {
                        gt: now.toISOString().split('T')[0]
                    }
                };
                break;

            case 'preorder':
                // Pre-order available (upcoming with cards listed)
                where = {
                    release_date: {
                        gt: now.toISOString().split('T')[0]
                    }
                };
                break;
        }

        // Get Pokemon sets
        const sets = await prisma.pokemonSet.findMany({
            where,
            orderBy: {
                release_date: type === 'upcoming' ? 'asc' : 'desc'
            },
            take: limit
        });

        // Get card counts and price stats for each set
        const setIds = sets.map(s => s.id);
        const cardStats = await prisma.card.groupBy({
            by: ['set_name'],
            where: {
                set_name: { in: sets.map(s => s.name) }
            },
            _count: {
                id: true
            },
            _avg: {
                market_price: true
            },
            _min: {
                market_price: true
            },
            _max: {
                market_price: true
            }
        });

        // Create stats map
        const statsMap = new Map(cardStats.map(stat => [stat.set_name, stat]));

        // Format response
        const formattedSets = sets.map(set => {
            const stats = statsMap.get(set.name);
            const daysUntilRelease = set.release_date ?
                Math.ceil((new Date(set.release_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

            return {
                id: set.id,
                name: set.name,
                series: set.series,
                release_date: set.release_date,
                days_until_release: daysUntilRelease != null && daysUntilRelease > 0 ? daysUntilRelease : null,
                total_cards: set.total || 0,
                printed_total: set.printed_total || 0,
                images: set.images,
                card_count: stats?._count.id || 0,
                avg_price: stats?._avg.market_price ? parseFloat(stats._avg.market_price.toString()) : null,
                min_price: stats?._min.market_price ? parseFloat(stats._min.market_price.toString()) : null,
                max_price: stats?._max.market_price ? parseFloat(stats._max.market_price.toString()) : null,
                is_released: daysUntilRelease !== null && daysUntilRelease <= 0,
                preorder_available: type === 'preorder' && (stats?._count.id || 0) > 0
            };
        });

        return NextResponse.json({
            success: true,
            data: formattedSets,
            type
        });

    } catch (error) {
        console.error('Error fetching new releases:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch new releases' },
            { status: 500 }
        );
    }
}