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
                    set_release_date: {
                        gte: thirtyDaysAgo.toISOString().split('T')[0],
                        lte: now.toISOString().split('T')[0]
                    }
                };
                break;

            case 'upcoming':
                // Upcoming releases
                where = {
                    set_release_date: {
                        gt: now.toISOString().split('T')[0]
                    }
                };
                break;

            case 'preorder':
                // Pre-order available (upcoming with cards listed)
                where = {
                    set_release_date: {
                        gt: now.toISOString().split('T')[0]
                    }
                };
                break;
        }

        // Get distinct sets from cards since there's no separate PokemonSet model
        // Group by set information to get unique sets
        const setGroups = await prisma.card.groupBy({
            by: ['set_name', 'set_id', 'set_series'],
            where: {
                ...where,
                set_name: { not: { equals: "" } } // Only cards with set names
            },
            _count: {
                id: true
            },
            _avg: {
                market_price: true
            },
            _min: {
                market_price: true,
                set_release_date: true
            },
            _max: {
                market_price: true,
                set_printed_total: true,
                set_total: true
            },
            orderBy: {
                set_name: type === 'upcoming' ? 'asc' : 'desc'
            },
            take: limit
        });

        // Format response
        const formattedSets = setGroups.map((setGroup: any) => {
            const releaseDate = setGroup._min.set_release_date;
            const daysUntilRelease = releaseDate ?
                Math.ceil((new Date(releaseDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

            return {
                id: setGroup.set_id,
                name: setGroup.set_name,
                series: setGroup.set_series,
                release_date: releaseDate,
                days_until_release: daysUntilRelease != null && daysUntilRelease > 0 ? daysUntilRelease : null,
                total_cards: setGroup._max.set_total || 0,
                printed_total: setGroup._max.set_printed_total || 0,
                images: null, // Not available in current schema
                card_count: setGroup._count.id || 0,
                avg_price: setGroup._avg.market_price ? parseFloat(setGroup._avg.market_price.toString()) : null,
                min_price: setGroup._min.market_price ? parseFloat(setGroup._min.market_price.toString()) : null,
                max_price: setGroup._max.market_price ? parseFloat(setGroup._max.market_price.toString()) : null,
                is_released: daysUntilRelease !== null && daysUntilRelease <= 0,
                preorder_available: type === 'preorder' && (setGroup._count.id || 0) > 0
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