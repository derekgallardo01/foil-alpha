// src/app/api/admin/listings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
// import { getCurrentUser } from '../../../lib/dev-auth';

// GET /api/admin/listings - Get all admin marketplace listings
export async function GET(request: NextRequest) {
    try {
        // const user = await getCurrentUser(request);
        const user = { id: 1, email: 'admin@test.com', name: 'Admin User', role: 'admin' }

        if (!user || user.role !== 'admin') {
            return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const search = searchParams.get('search') || '';
        const saleType = searchParams.get('saleType') || '';
        const status = searchParams.get('status') || '';

        const skip = (page - 1) * limit;

        // Build where clause for admin listings (listings owned by admin)
        const where: any = {
            owner: {
                role: 'admin'
            }
        };

        // Add filters
        if (search) {
            where.card = {
                name: {
                    contains: search
                }
            };
        }

        if (saleType) {
            where.sale_type = saleType;
        }

        if (status === 'active') {
            where.is_for_sale = true;
            where.is_sold = false;
        } else if (status === 'sold') {
            where.is_sold = true;
        } else if (status === 'inactive') {
            where.is_for_sale = false;
            where.is_sold = false;
        }

        // Get admin listings
        const [listings, totalCount] = await Promise.all([
            prisma.userCard.findMany({
                where,
                skip,
                take: limit,
                orderBy: { created_at: 'desc' },
                include: {
                    card: true,
                    owner: {
                        select: { id: true, name: true, role: true }
                    },
                    bids: {
                        where: { is_active: true },
                        orderBy: { amount: 'desc' },
                        take: 5,
                        include: {
                            bidder: {
                                select: { id: true, name: true }
                            }
                        }
                    },
                    cardHistory: {
                        orderBy: { created_at: 'desc' },
                        take: 1,
                        include: {
                            fromUser: {
                                select: { id: true, name: true }
                            },
                            toUser: {
                                select: { id: true, name: true }
                            }
                        }
                    }
                }
            }),
            prisma.userCard.count({ where })
        ]);

        // Add computed fields
        const listingsWithStats = listings.map(listing => {
            const currentHighestBid = listing.bids[0];
            const timeLeft = listing.auction_end
                ? Math.max(0, listing.auction_end.getTime() - Date.now())
                : null;

            return {
                ...listing,
                current_highest_bid: currentHighestBid?.amount || null,
                bid_count: listing.bids.length,
                time_left_ms: timeLeft,
                is_auction_active: listing.sale_type === 'AUCTION' &&
                    (!listing.auction_end || listing.auction_end > new Date()),
                latest_activity: listing.cardHistory[0] || null
            };
        });

        return NextResponse.json({
            listings: listingsWithStats,
            pagination: {
                page,
                limit,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit)
            }
        });

    } catch (error) {
        console.error('Error fetching admin listings:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch listings',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

// POST /api/admin/listings - Create new marketplace listing
export async function POST(request: NextRequest) {
    try {
        // const user = await getCurrentUser(request);
        const user = { id: 1, email: 'admin@test.com', name: 'Admin User', role: 'admin' }

        if (!user || user.role !== 'admin') {
            return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const {
            card_id,
            condition,
            sale_type,
            fixed_price,
            reserve_price,
            auction_duration_hours,
            notes,
            quantity = 1
        } = body;

        // Validate required fields
        if (!card_id || !condition || !sale_type) {
            return NextResponse.json(
                { error: 'Missing required fields: card_id, condition, sale_type' },
                { status: 400 }
            );
        }

        // Verify card exists
        const card = await prisma.card.findUnique({
            where: { id: parseInt(card_id) }
        });

        if (!card) {
            return NextResponse.json(
                { error: 'Card not found' },
                { status: 404 }
            );
        }

        // Validate pricing based on sale type
        if (sale_type === 'FIXED' && (!fixed_price || parseFloat(fixed_price) <= 0)) {
            return NextResponse.json(
                { error: 'Fixed price is required and must be greater than 0' },
                { status: 400 }
            );
        }

        if (sale_type === 'AUCTION') {
            if (!auction_duration_hours || parseInt(auction_duration_hours) <= 0) {
                return NextResponse.json(
                    { error: 'Auction duration is required and must be greater than 0' },
                    { status: 400 }
                );
            }
            if (reserve_price && parseFloat(reserve_price) <= 0) {
                return NextResponse.json(
                    { error: 'Reserve price must be greater than 0 if provided' },
                    { status: 400 }
                );
            }
        }

        // Create listings (can create multiple if quantity > 1)
        const createdListings = [];

        for (let i = 0; i < quantity; i++) {
            // Prepare listing data
            const listingData: any = {
                card_id: parseInt(card_id),
                owner_id: user.id,
                condition,
                is_for_sale: true,
                sale_type,
                notes: notes || `Admin listing - ${condition} condition`
            };

            if (sale_type === 'FIXED') {
                listingData.fixed_price = parseFloat(fixed_price);
            } else if (sale_type === 'AUCTION') {
                listingData.reserve_price = reserve_price ? parseFloat(reserve_price) : null;
                const auctionEnd = new Date();
                auctionEnd.setHours(auctionEnd.getHours() + parseInt(auction_duration_hours));
                listingData.auction_end = auctionEnd;
            }

            // Create the listing and history record in a transaction
            const result = await prisma.$transaction(async (tx) => {
                // Create user card (listing)
                const userCard = await tx.userCard.create({
                    data: listingData,
                    include: {
                        card: true,
                        owner: {
                            select: { id: true, name: true, role: true }
                        }
                    }
                });

                // Create history record
                await tx.cardHistory.create({
                    data: {
                        user_card_id: userCard.id,
                        to_user_id: user.id,
                        transaction_type: 'INITIAL',
                        notes: `Admin created marketplace listing - ${sale_type} sale`
                    }
                });

                return userCard;
            });

            createdListings.push(result);
        }

        return NextResponse.json({
            message: `Created ${quantity} listing(s) successfully`,
            listings: createdListings
        }, { status: 201 });

    } catch (error) {
        console.error('Error creating listing:', error);
        return NextResponse.json(
            {
                error: 'Failed to create listing',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}