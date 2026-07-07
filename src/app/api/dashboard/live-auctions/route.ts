import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '10');
        const sortBy = searchParams.get('sortBy') || 'ending_soon'; // 'ending_soon', 'most_bids', 'highest_price'

        let orderBy: any = {};

        switch (sortBy) {
            case 'ending_soon':
                orderBy = { auction_end: 'asc' };
                break;
            case 'most_bids':
                // This will be handled after fetching
                orderBy = { created_at: 'desc' };
                break;
            case 'highest_price':
                orderBy = { reserve_price: 'desc' };
                break;
        }

        // Get active auctions
        const activeAuctions = await prisma.userCard.findMany({
            where: {
                sale_type: 'AUCTION',
                is_for_sale: true,
                is_sold: false,
                auction_end: { gte: new Date() }
            },
            orderBy,
            take: limit * 2, // Get more to filter after bid count
        });

        if (activeAuctions.length === 0) {
            return NextResponse.json({
                success: true,
                data: [],
                total: 0
            });
        }

        // Get card and user details
        const cardIds = [...new Set(activeAuctions.map(a => a.card_id))];
        const ownerIds = [...new Set(activeAuctions.map(a => a.owner_id))];
        const auctionIds = activeAuctions.map(a => a.id);

        const [cards, owners, bids] = await Promise.all([
            prisma.card.findMany({
                where: { id: { in: cardIds } },
                select: {
                    id: true,
                    name: true,
                    set_name: true,
                    rarity: true,
                    image_url: true, // FIXED: Changed from image_small to image_url (matching schema)
                    market_price: true,
                }
            }),
            prisma.user.findMany({
                where: { id: { in: ownerIds } },
                select: {
                    id: true,
                    name: true,
                }
            }),
            prisma.bid.findMany({
                where: {
                    userCardId: { in: auctionIds },
                    is_active: true
                },
                orderBy: { amount: 'desc' }
            })
        ]);

        // Create lookup maps
        const cardMap = new Map(cards.map(c => [c.id, c]));
        const ownerMap = new Map(owners.map(o => [o.id, o]));

        // Group bids by auction
        const bidsByAuction = new Map<number, typeof bids>();
        bids.forEach(bid => {
            const auctionBids = bidsByAuction.get(bid.userCardId) || [];
            auctionBids.push(bid);
            bidsByAuction.set(bid.userCardId, auctionBids);
        });

        // Format auction data
        const formattedAuctions = activeAuctions.map(auction => {
            const card = cardMap.get(auction.card_id);
            const owner = ownerMap.get(auction.owner_id);
            const auctionBids = bidsByAuction.get(auction.id) || [];
            const highestBid = auctionBids[0];
            const timeRemaining = auction.auction_end ?
                Math.max(0, new Date(auction.auction_end).getTime() - Date.now()) : 0;

            return {
                id: auction.id,
                card: card ? {
                    id: card.id,
                    name: card.name,
                    set_name: card.set_name,
                    rarity: card.rarity,
                    image_url: card.image_url, // FIXED: Changed from image_small to image_url
                    market_price: card.market_price ? parseFloat(card.market_price.toString()) : null
                } : null,
                seller: owner?.name || 'Unknown',
                current_bid: highestBid ? parseFloat(highestBid.amount.toString()) : null,
                reserve_price: auction.reserve_price ? parseFloat(auction.reserve_price.toString()) : null,
                bid_count: auctionBids.length,
                time_remaining: timeRemaining,
                auction_end: auction.auction_end,
                condition: auction.condition,
            };
        }).filter(a => a.card !== null);

        // Sort by bid count if requested
        if (sortBy === 'most_bids') {
            formattedAuctions.sort((a, b) => b.bid_count - a.bid_count);
        }

        // Limit results
        const finalResults = formattedAuctions.slice(0, limit);

        return NextResponse.json({
            success: true,
            data: finalResults,
            total: finalResults.length
        });

    } catch (error) {
        console.error('Error fetching live auctions:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch live auctions' },
            { status: 500 }
        );
    }
}