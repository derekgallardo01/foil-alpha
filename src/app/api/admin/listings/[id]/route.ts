// src/app/api/admin/listings/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
// import { getCurrentUser } from '../../../../lib/dev-auth';

// GET /api/admin/listings/[id] - Get specific listing
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        // const user = await getCurrentUser(request);
        const user = { id: 1, email: 'admin@test.com', name: 'Admin User', role: 'admin' }

        if (!user || user.role !== 'admin') {
            return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 }
            );
        }

        const listingId = parseInt(params.id);

        const listing = await prisma.userCard.findUnique({
            where: { id: listingId },
            include: {
                card: true,
                owner: {
                    select: { id: true, name: true, role: true }
                },
                bids: {
                    where: { is_active: true },
                    orderBy: { amount: 'desc' },
                    include: {
                        bidder: {
                            select: { id: true, name: true, email: true }
                        }
                    }
                },
                cardHistory: {
                    orderBy: { created_at: 'desc' },
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
        });

        if (!listing) {
            return NextResponse.json(
                { error: 'Listing not found' },
                { status: 404 }
            );
        }

        // Add computed fields
        const currentHighestBid = listing.bids[0];
        const timeLeft = listing.auction_end
            ? Math.max(0, listing.auction_end.getTime() - Date.now())
            : null;

        const listingWithStats = {
            ...listing,
            current_highest_bid: currentHighestBid?.amount || null,
            bid_count: listing.bids.length,
            time_left_ms: timeLeft,
            is_auction_active: listing.sale_type === 'AUCTION' &&
                (!listing.auction_end || listing.auction_end > new Date())
        };

        return NextResponse.json(listingWithStats);

    } catch (error) {
        console.error('Error fetching listing:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch listing',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

// PUT /api/admin/listings/[id] - Update listing
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        // const user = await getCurrentUser(request);
        const user = { id: 1, email: 'admin@test.com', name: 'Admin User', role: 'admin' }

        if (!user || user.role !== 'admin') {
            return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 }
            );
        }

        const listingId = parseInt(params.id);
        const body = await request.json();

        const {
            is_for_sale,
            sale_type,
            fixed_price,
            reserve_price,
            auction_duration_hours,
            notes
        } = body;

        // Check if listing exists and is admin-owned
        const existingListing = await prisma.userCard.findUnique({
            where: { id: listingId },
            include: {
                owner: true
            }
        });

        if (!existingListing) {
            return NextResponse.json(
                { error: 'Listing not found' },
                { status: 404 }
            );
        }

        if (existingListing.owner.role !== 'admin') {
            return NextResponse.json(
                { error: 'Can only edit admin listings' },
                { status: 403 }
            );
        }

        // Prepare update data
        const updateData: any = {};

        if (typeof is_for_sale === 'boolean') {
            updateData.is_for_sale = is_for_sale;
        }

        if (sale_type) {
            updateData.sale_type = sale_type;

            if (sale_type === 'FIXED' && fixed_price) {
                updateData.fixed_price = parseFloat(fixed_price);
                updateData.reserve_price = null;
                updateData.auction_end = null;
            } else if (sale_type === 'AUCTION') {
                updateData.fixed_price = null;
                if (reserve_price !== undefined) {
                    updateData.reserve_price = reserve_price ? parseFloat(reserve_price) : null;
                }
                if (auction_duration_hours) {
                    const auctionEnd = new Date();
                    auctionEnd.setHours(auctionEnd.getHours() + parseInt(auction_duration_hours));
                    updateData.auction_end = auctionEnd;
                }
            }
        }

        if (notes !== undefined) {
            updateData.notes = notes;
        }

        // Update listing
        const updatedListing = await prisma.userCard.update({
            where: { id: listingId },
            data: updateData,
            include: {
                card: true,
                owner: {
                    select: { id: true, name: true, role: true }
                },
                bids: {
                    where: { is_active: true },
                    orderBy: { amount: 'desc' }
                }
            }
        });

        return NextResponse.json(updatedListing);

    } catch (error) {
        console.error('Error updating listing:', error);
        return NextResponse.json(
            {
                error: 'Failed to update listing',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

// DELETE /api/admin/listings/[id] - Delete listing
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        // const user = await getCurrentUser(request);
        const user = { id: 1, email: 'admin@test.com', name: 'Admin User', role: 'admin' }

        if (!user || user.role !== 'admin') {
            return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 }
            );
        }

        const listingId = parseInt(params.id);

        // Check if listing exists and is admin-owned
        const existingListing = await prisma.userCard.findUnique({
            where: { id: listingId },
            include: {
                owner: true,
                bids: {
                    where: { is_active: true }
                }
            }
        });

        if (!existingListing) {
            return NextResponse.json(
                { error: 'Listing not found' },
                { status: 404 }
            );
        }

        if (existingListing.owner.role !== 'admin') {
            return NextResponse.json(
                { error: 'Can only delete admin listings' },
                { status: 403 }
            );
        }

        // Check if listing has active bids
        if (existingListing.bids.length > 0 && !existingListing.is_sold) {
            return NextResponse.json(
                {
                    error: 'Cannot delete listing with active bids',
                    details: `This listing has ${existingListing.bids.length} active bid(s)`
                },
                { status: 400 }
            );
        }

        // Delete listing
        await prisma.userCard.delete({
            where: { id: listingId }
        });

        return NextResponse.json({ message: 'Listing deleted successfully' });

    } catch (error) {
        console.error('Error deleting listing:', error);
        return NextResponse.json(
            {
                error: 'Failed to delete listing',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}