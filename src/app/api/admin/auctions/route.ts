// src/app/api/admin/auctions/route.ts - Main admin auction API
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

        const auctions = await prisma.userCard.findMany({
            where,
            include: {
                card: {
                    select: {
                        id: true,
                        name: true,
                        set_name: true,
                        image_url: true,
                        small_image_url: true
                    }
                },
                owner: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                bids: {
                    where: { is_active: true },
                    include: {
                        bidder: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    },
                    orderBy: { amount: 'desc' }
                }
            },
            orderBy: { created_at: 'desc' },
            take: limit
        });

        // Calculate additional fields
        const auctionsWithDetails = auctions.map(auction => {
            const now = new Date();
            const auctionEnd = auction.auction_end ? new Date(auction.auction_end) : null;
            const timeRemaining = auctionEnd ? Math.max(0, auctionEnd.getTime() - now.getTime()) : null;
            const highestBid = auction.bids.length > 0 ? Number(auction.bids[0].amount) : null;

            return {
                id: auction.id,
                card: auction.card,
                owner: auction.owner,
                condition: auction.condition,
                reserve_price: Number(auction.reserve_price),
                auction_end: auction.auction_end,
                is_sold: auction.is_sold,
                is_for_sale: auction.is_for_sale,
                time_remaining: timeRemaining,
                bids: auction.bids.map(bid => ({
                    id: bid.id,
                    amount: Number(bid.amount),
                    bidder: bid.bidder,
                    created_at: bid.created_at,
                    is_active: bid.is_active
                })),
                highest_bid: highestBid,
                bid_count: auction.bids.length,
                created_at: auction.created_at
            };
        });

        return NextResponse.json({
            auctions: auctionsWithDetails,
            total: auctions.length
        });

    } catch (error) {
        console.error('Error fetching admin auctions:', error);
        return NextResponse.json(
            { error: 'Failed to fetch auctions' },
            { status: 500 }
        );
    }
}