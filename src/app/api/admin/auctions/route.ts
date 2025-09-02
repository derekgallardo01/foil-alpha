// src/app/api/admin/auctions/route.ts - Updated version
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '../../../lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status'); // 'active', 'ended', 'all'
        const limit = parseInt(searchParams.get('limit') || '50');

        let where: any = {
            sale_type: 'AUCTION'
        };

        if (status === 'active') {
            where.is_for_sale = true;
            where.is_sold = false;
            where.auction_end = { gte: new Date() };
        } else if (status === 'ended') {
            where.OR = [
                { is_sold: true },
                { is_for_sale: false },
                { auction_end: { lte: new Date() } }
            ];
        }

        // Get active auction count for dashboard
        const activeAuctionsCount = await prisma.userCard.count({
            where: {
                sale_type: 'AUCTION',
                is_for_sale: true,
                is_sold: false,
                auction_end: { gte: new Date() }
            }
        });

        // Fetch auctions without includes to avoid type issues
        const auctions = await prisma.userCard.findMany({
            where,
            orderBy: { created_at: 'desc' },
            take: limit
        });

        // Get all unique card IDs and owner IDs
        const cardIds = [...new Set(auctions.map(auction => auction.card_id))];
        const ownerIds = [...new Set(auctions.map(auction => auction.owner_id))];
        const auctionIds = auctions.map(auction => auction.id);

        // Fetch related data separately
        const [cards, owners, allBids] = await Promise.all([
            prisma.card.findMany({
                where: { id: { in: cardIds } },
                select: {
                    id: true,
                    name: true,
                    set_name: true,
                    image_url: true,
                    small_image_url: true
                }
            }),
            prisma.user.findMany({
                where: { id: { in: ownerIds } },
                select: {
                    id: true,
                    name: true,
                    email: true
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

        // Get bidder IDs from bids
        const bidderIds = [...new Set(allBids.map(bid => bid.bidderId))];

        // Fetch bidders
        const bidders = await prisma.user.findMany({
            where: { id: { in: bidderIds } },
            select: {
                id: true,
                name: true,
                email: true
            }
        });

        // Create lookup maps for better performance
        const cardMap = new Map(cards.map(card => [card.id, card]));
        const ownerMap = new Map(owners.map(owner => [owner.id, owner]));
        const bidderMap = new Map(bidders.map(bidder => [bidder.id, bidder]));

        // Group bids by auction ID
        const bidsByAuction = new Map();
        allBids.forEach(bid => {
            if (!bidsByAuction.has(bid.userCardId)) {
                bidsByAuction.set(bid.userCardId, []);
            }
            bidsByAuction.get(bid.userCardId).push({
                id: bid.id,
                amount: Number(bid.amount),
                bidder: bidderMap.get(bid.bidderId),
                created_at: bid.createdAt,
                is_active: bid.is_active
            });
        });

        // Calculate additional fields
        const auctionsWithDetails = auctions.map(auction => {
            const now = new Date();
            const auctionEnd = auction.auction_end ? new Date(auction.auction_end) : null;
            const timeRemaining = auctionEnd ? Math.max(0, auctionEnd.getTime() - now.getTime()) : null;

            const auctionBids = bidsByAuction.get(auction.id) || [];
            const highestBid = auctionBids.length > 0 ? auctionBids[0].amount : null;

            return {
                id: auction.id,
                card: cardMap.get(auction.card_id),
                owner: ownerMap.get(auction.owner_id),
                condition: auction.condition,
                reserve_price: Number(auction.reserve_price),
                auction_end: auction.auction_end,
                is_sold: auction.is_sold,
                is_for_sale: auction.is_for_sale,
                time_remaining: timeRemaining,
                bids: auctionBids,
                highest_bid: highestBid,
                bid_count: auctionBids.length,
                created_at: auction.created_at
            };
        });

        return NextResponse.json({
            auctions: auctionsWithDetails,
            total: auctions.length,
            activeAuctions: activeAuctionsCount // Added for dashboard
        });

    } catch (error) {
        console.error('Error fetching admin auctions:', error);
        return NextResponse.json(
            { error: 'Failed to fetch auctions' },
            { status: 500 }
        );
    }
}