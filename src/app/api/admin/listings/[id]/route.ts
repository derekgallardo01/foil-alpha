import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

function getIdFromRequest(request: NextRequest): string | null {
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  const id = segments.pop() || segments.pop();
  return id ?? null;
}

interface UpdateListingData {
  is_for_sale?: boolean;
  sale_type?: string;
  fixed_price?: number | null;
  reserve_price?: number | null;
  auction_duration_hours?: string;
  notes?: string;
  auction_end?: Date | null;
}

export async function GET(request: NextRequest) {
  const id = getIdFromRequest(request);
  if (!id) return NextResponse.json({ error: 'Invalid listing ID' }, { status: 400 });

  const listingId = parseInt(id, 10);
  if (isNaN(listingId)) return NextResponse.json({ error: 'Invalid listing ID' }, { status: 400 });

  try {
    const user = { id: 1, email: 'admin@test.com', name: 'Admin User', role: 'admin' };
    if (user.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    // Get the listing
    const listing = await prisma.userCard.findUnique({
      where: { id: listingId }
    });

    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 });

    // Get the card details
    const card = await prisma.card.findUnique({
      where: { id: listing.card_id }
    });

    // Get the owner details
    const owner = await prisma.user.findUnique({
      where: { id: listing.owner_id },
      select: { id: true, name: true, role: true }
    });

    // Get active bids
    const bids = await prisma.bid.findMany({
      where: {
        userCardId: listingId,
        is_active: true
      },
      orderBy: { amount: 'desc' }
    });

    // Get bidder details for each bid
    const bidsWithBidder = await Promise.all(
      bids.map(async (bid) => {
        const bidder = await prisma.user.findUnique({
          where: { id: bid.bidderId },
          select: { id: true, name: true, email: true }
        });
        return { ...bid, bidder };
      })
    );

    // Get transaction history
    const history = await prisma.cardTransactionHistory.findMany({
      where: { userCardId: listingId },
      orderBy: { created_at: 'desc' }
    });

    // Get user details for transaction history
    const historyWithUsers = await Promise.all(
      history.map(async (transaction) => {
        const fromUser = transaction.fromUserId ? await prisma.user.findUnique({
          where: { id: transaction.fromUserId },
          select: { id: true, name: true }
        }) : null;

        const toUser = transaction.toUserId ? await prisma.user.findUnique({
          where: { id: transaction.toUserId },
          select: { id: true, name: true }
        }) : null;

        return { ...transaction, fromUser, toUser };
      })
    );

    const currentHighestBid = bidsWithBidder[0];
    const timeLeft = listing.auction_end ? Math.max(0, listing.auction_end.getTime() - Date.now()) : null;

    return NextResponse.json({
      ...listing,
      card,
      owner,
      bids: bidsWithBidder,
      history: historyWithUsers,
      current_highest_bid: currentHighestBid?.amount ?? null,
      bid_count: bidsWithBidder.length,
      time_left_ms: timeLeft,
      is_auction_active:
        listing.sale_type === 'AUCTION' &&
        (!listing.auction_end || listing.auction_end > new Date())
    });
  } catch (error) {
    console.error('Error fetching listing:', error);
    return NextResponse.json({ error: 'Failed to fetch listing', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const id = getIdFromRequest(request);
  if (!id) return NextResponse.json({ error: 'Invalid listing ID' }, { status: 400 });

  const listingId = parseInt(id, 10);
  if (isNaN(listingId)) return NextResponse.json({ error: 'Invalid listing ID' }, { status: 400 });

  try {
    const user = { id: 1, email: 'admin@test.com', name: 'Admin User', role: 'admin' };
    if (user.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const body: UpdateListingData = await request.json();
    const { is_for_sale, sale_type, fixed_price, reserve_price, auction_duration_hours, notes } = body;

    const existingListing = await prisma.userCard.findUnique({
      where: { id: listingId }
    });

    if (!existingListing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 });

    // Get owner details
    const owner = await prisma.user.findUnique({
      where: { id: existingListing.owner_id }
    });

    if (!owner) return NextResponse.json({ error: 'Owner not found' }, { status: 404 });
    if (owner.role !== 'admin') return NextResponse.json({ error: 'Can only edit admin listings' }, { status: 403 });

    const updateData: Partial<UpdateListingData> & { auction_end?: Date | null } = {};

    if (typeof is_for_sale === 'boolean') updateData.is_for_sale = is_for_sale;

    if (sale_type) {
      if (!['FIXED', 'AUCTION'].includes(sale_type)) {
        return NextResponse.json({ error: 'Invalid sale type' }, { status: 400 });
      }
      updateData.sale_type = sale_type;

      if (sale_type === 'FIXED') {
        if (fixed_price === null || fixed_price === undefined) {
          return NextResponse.json({ error: 'Fixed price is required for FIXED sale type' }, { status: 400 });
        }
        const parsedFixed = Number(fixed_price);
        if (isNaN(parsedFixed) || parsedFixed <= 0) {
          return NextResponse.json({ error: 'Invalid fixed price' }, { status: 400 });
        }
        updateData.fixed_price = parsedFixed;
        updateData.reserve_price = undefined;
        updateData.auction_end = null;
      } else if (sale_type === 'AUCTION') {
        updateData.fixed_price = undefined;

        if (reserve_price !== undefined && reserve_price !== null) {
          const parsedReserve = Number(reserve_price);
          if (isNaN(parsedReserve) || parsedReserve <= 0) {
            return NextResponse.json({ error: 'Invalid reserve price' }, { status: 400 });
          }
          updateData.reserve_price = parsedReserve;
        } else {
          updateData.reserve_price = undefined;
        }

        if (auction_duration_hours) {
          const duration = parseInt(auction_duration_hours, 10);
          if (isNaN(duration) || duration <= 0) {
            return NextResponse.json({ error: 'Invalid auction duration' }, { status: 400 });
          }
          const end = new Date();
          end.setHours(end.getHours() + duration);
          updateData.auction_end = end;
        } else {
          updateData.auction_end = undefined;
        }
      }
    }

    if (notes !== undefined) updateData.notes = notes;

    const updatedListing = await prisma.userCard.update({
      where: { id: listingId },
      data: updateData
    });

    // Get related data separately
    const card = await prisma.card.findUnique({
      where: { id: updatedListing.card_id }
    });

    const ownerData = await prisma.user.findUnique({
      where: { id: updatedListing.owner_id },
      select: { id: true, name: true, role: true }
    });

    const bids = await prisma.bid.findMany({
      where: {
        userCardId: listingId,
        is_active: true
      },
      orderBy: { amount: 'desc' }
    });

    const history = await prisma.cardTransactionHistory.findMany({
      where: { userCardId: listingId },
      orderBy: { created_at: 'desc' }
    });

    // Get user details for transaction history
    const historyWithUsers = await Promise.all(
      history.map(async (transaction) => {
        const fromUser = transaction.fromUserId ? await prisma.user.findUnique({
          where: { id: transaction.fromUserId },
          select: { id: true, name: true }
        }) : null;

        const toUser = transaction.toUserId ? await prisma.user.findUnique({
          where: { id: transaction.toUserId },
          select: { id: true, name: true }
        }) : null;

        return { ...transaction, fromUser, toUser };
      })
    );

    return NextResponse.json({
      ...updatedListing,
      card,
      owner: ownerData,
      bids,
      history: historyWithUsers
    });
  } catch (error) {
    console.error('Error updating listing:', error);
    return NextResponse.json({ error: 'Failed to update listing', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const id = getIdFromRequest(request);
  if (!id) return NextResponse.json({ error: 'Invalid listing ID' }, { status: 400 });

  const listingId = parseInt(id, 10);
  if (isNaN(listingId)) return NextResponse.json({ error: 'Invalid listing ID' }, { status: 400 });

  try {
    const user = { id: 1, email: 'admin@test.com', name: 'Admin User', role: 'admin' };
    if (user.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const existingListing = await prisma.userCard.findUnique({
      where: { id: listingId }
    });

    if (!existingListing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 });

    // Get owner details
    const owner = await prisma.user.findUnique({
      where: { id: existingListing.owner_id }
    });

    if (!owner) return NextResponse.json({ error: 'Owner not found' }, { status: 404 });
    if (owner.role !== 'admin') return NextResponse.json({ error: 'Can only delete admin listings' }, { status: 403 });

    // Get active bids
    const bids = await prisma.bid.findMany({
      where: {
        userCardId: listingId,
        is_active: true
      }
    });

    if (bids.length > 0 && !existingListing.is_sold) {
      return NextResponse.json({
        error: 'Cannot delete listing with active bids',
        details: `This listing has ${bids.length} active bid(s)`
      }, { status: 400 });
    }

    await prisma.userCard.delete({ where: { id: listingId } });
    return NextResponse.json({ message: 'Listing deleted successfully' });
  } catch (error) {
    console.error('Error deleting listing:', error);
    return NextResponse.json({ error: 'Failed to delete listing', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}