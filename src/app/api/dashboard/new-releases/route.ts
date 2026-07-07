import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '10');
        const type = searchParams.get('type') || 'recent'; // 'recent', 'upcoming', 'popular'

        const now = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let where: any = {};

        switch (type) {
            case 'recent':
                // Recently added cards (last 30 days)
                where = {
                    created_at: {
                        gte: thirtyDaysAgo
                    },
                    market_price: { not: null, gt: 0 }
                };
                break;

            case 'upcoming':
                // Cards with high market value (representing "premium" new releases)
                where = {
                    market_price: { gte: 50 }, // Cards $50+
                    created_at: {
                        gte: thirtyDaysAgo
                    }
                };
                break;

            case 'popular':
                // Cards with most views or high market value
                where = {
                    market_price: { not: null, gt: 0 },
                    view_count: { gt: 0 }
                };
                break;
        }

        // Get distinct sets from cards since there's no separate set model
        // Group by set information to get unique sets
        const setGroups = await prisma.card.groupBy({
            by: ['set_name', 'set_id'], // FIXED: Only use fields that exist in schema
            where: {
                ...where,
                set_name: { not: { equals: "" } }, // Only cards with set names
                sync_enabled: true // Only active cards
            },
            _count: {
                id: true
            },
            _avg: {
                market_price: true
            },
            _min: {
                market_price: true,
                created_at: true // FIXED: Use created_at instead of set_release_date
            },
            _max: {
                market_price: true
                // FIXED: Removed non-existent fields set_printed_total, set_total
            },
            orderBy: {
                _count: {
                    id: 'desc' // Order by number of cards in set
                }
            },
            take: limit
        });

        // Get sample cards for each set to show representative images
        const setIds = setGroups.map(group => group.set_id);
        const sampleCards = await prisma.card.findMany({
            where: {
                set_id: { in: setIds },
                image_url: { not: null },
                market_price: { not: null, gt: 0 }
            },
            select: {
                set_id: true,
                image_url: true,
                name: true,
                rarity: true
            },
            take: setIds.length * 3, // Get up to 3 sample cards per set
        });

        // Group sample cards by set
        const cardsBySet = new Map<string, typeof sampleCards>();
        sampleCards.forEach(card => {
            const setCards = cardsBySet.get(card.set_id) || [];
            setCards.push(card);
            cardsBySet.set(card.set_id, setCards);
        });

        // Format response
        const formattedSets = setGroups.map((setGroup: any) => {
            const setCards = cardsBySet.get(setGroup.set_id) || [];
            const createdDate = setGroup._min.created_at;
            const daysOld = createdDate ?
                Math.floor((now.getTime() - new Date(createdDate).getTime()) / (1000 * 60 * 60 * 24)) : null;

            return {
                id: setGroup.set_id,
                name: setGroup.set_name,
                series: null, // Not available in current schema
                release_date: createdDate, // Using created_at as proxy for release date
                days_since_added: daysOld,
                total_cards: setGroup._count.id || 0,
                printed_total: null, // Not available in current schema
                images: setCards.slice(0, 3).map(card => ({ // Show up to 3 sample images
                    small: card.image_url,
                    large: card.image_url
                })),
                sample_cards: setCards.slice(0, 3).map(card => ({
                    name: card.name,
                    rarity: card.rarity,
                    image_url: card.image_url
                })),
                card_count: setGroup._count.id || 0,
                avg_price: setGroup._avg.market_price ? parseFloat(setGroup._avg.market_price.toString()) : null,
                min_price: setGroup._min.market_price ? parseFloat(setGroup._min.market_price.toString()) : null,
                max_price: setGroup._max.market_price ? parseFloat(setGroup._max.market_price.toString()) : null,
                is_new: daysOld !== null && daysOld <= 30,
                is_featured: type === 'popular' && (setGroup._count.id || 0) > 10 // Sets with 10+ cards
            };
        });

        return NextResponse.json({
            success: true,
            data: formattedSets,
            type,
            total: formattedSets.length
        });

    } catch (error) {
        console.error('Error fetching new releases:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch new releases' },
            { status: 500 }
        );
    }
}