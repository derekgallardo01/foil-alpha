import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '../../../lib/prisma';

// Interface for update data
interface UpdateCardData {
  notes?: string | null;
  is_for_sale?: boolean;
  sale_type?: 'FIXED' | 'AUCTION' | null;
  fixed_price?: number | null;
  reserve_price?: number | null;
  auction_end?: Date | null;
  updated_at?: Date;
}

// GET /api/user-cards/[id] - Get specific user card details
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Always use real session (ignore dev mode)
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await context.params;
    const userCardId = parseInt(id);

    console.log(`📋 Fetching user card ${userCardId} for user ${session.user.name} (ID: ${session.user.id})`);

    const userCard = await prisma.userCard.findUnique({
      where: { id: userCardId },
      include: {
        card: true,
        owner: {
          select: { id: true, name: true, email: true }
        },
        bids: {
          where: { is_active: true },
          orderBy: { amount: 'desc' },
          include: {
            bidder: {
              select: { id: true, name: true }
            }
          }
        },
        history: {
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

    if (!userCard) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Get current price
    let currentPrice = null;
    if (userCard.sale_type === 'FIXED') {
      currentPrice = Number(userCard.fixed_price || 0);
    } else if (userCard.sale_type === 'AUCTION') {
      // Get highest bid
      const highestBid = userCard.bids[0]; // Already ordered by amount desc
      currentPrice = highestBid ? Number(highestBid.amount) : Number(userCard.reserve_price || 0);
    }

    // Calculate time remaining for auctions
    let timeRemaining = null;
    let isAuctionActive = false;
    if (userCard.sale_type === 'AUCTION' && userCard.auction_end) {
      const endTime = new Date(userCard.auction_end).getTime();
      const now = Date.now();
      timeRemaining = Math.max(0, endTime - now);
      isAuctionActive = timeRemaining > 0;
    }

    const result = {
      id: userCard.id,
      card: userCard.card,
      owner: userCard.owner,
      condition: userCard.condition,
      sale_type: userCard.sale_type,
      fixed_price: userCard.fixed_price ? Number(userCard.fixed_price) : null,
      reserve_price: userCard.reserve_price ? Number(userCard.reserve_price) : null,
      auction_end: userCard.auction_end,
      is_for_sale: userCard.is_for_sale,
      is_sold: userCard.is_sold,
      notes: userCard.notes,
      current_price: currentPrice,
      current_highest_bid: userCard.bids[0] ? Number(userCard.bids[0].amount) : null,
      bid_count: userCard.bids.length,
      time_left_ms: timeRemaining,
      is_auction_active: isAuctionActive,
      bids: userCard.bids.map(bid => ({
        id: bid.id,
        amount: Number(bid.amount),
        bidder: bid.bidder,
        created_at: bid.createdAt
      })),
      history: userCard.history,
      created_at: userCard.created_at,
      // updated_at: userCard.updated_at
    };

    console.log(`✅ Returning card data:`, {
      cardId: result.id,
      cardName: result.card.name,
      owner: result.owner.name,
      saleType: result.sale_type,
      currentPrice: result.current_price,
      bidCount: result.bid_count,
      isAuctionActive: result.is_auction_active
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Error fetching user card:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user card details' },
      { status: 500 }
    );
  }
}

// PUT /api/user-cards/[id] - Update user's card (listing, condition, notes)
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Always use real session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await context.params;
    const userCardId = parseInt(id);
    const userId = parseInt(session.user.id);

    const body = await request.json();

    // Verify user owns this card
    const existingUserCard = await prisma.userCard.findFirst({
      where: {
        id: userCardId,
        owner_id: userId,
      },
    });

    if (!existingUserCard) {
      return NextResponse.json(
        { error: 'Card not found or not owned by user' },
        { status: 404 },
      );
    }

    // Prepare update data
    const updateData: UpdateCardData = {
      notes: body.notes,
      is_for_sale: body.is_for_sale,
      updated_at: new Date(),
    };

    if (body.is_for_sale) {
      updateData.sale_type = body.sale_type;

      if (body.sale_type === 'FIXED') {
        updateData.fixed_price = parseFloat(body.fixed_price);
        updateData.reserve_price = null;
        updateData.auction_end = null;
      } else if (body.sale_type === 'AUCTION') {
        const auctionDurationHours = parseInt(body.auction_duration_hours || '168');
        const auctionEnd = new Date();
        auctionEnd.setHours(auctionEnd.getHours() + auctionDurationHours);

        updateData.reserve_price = parseFloat(body.reserve_price);
        updateData.fixed_price = null;
        updateData.auction_end = auctionEnd;

        // Cancel any existing bids if re-listing
        await prisma.bid.updateMany({
          where: {
            userCardId: userCardId,
            is_active: true,
          },
          data: {
            is_active: false,
          },
        });
      }
    } else {
      // Not for sale - clear sale data
      updateData.sale_type = null;
      updateData.fixed_price = null;
      updateData.reserve_price = null;
      updateData.auction_end = null;

      // Cancel any active bids
      await prisma.bid.updateMany({
        where: {
          userCardId: userCardId,
          is_active: true,
        },
        data: {
          is_active: false,
        },
      });
    }

    // Update the card
    const updatedUserCard = await prisma.userCard.update({
      where: { id: userCardId },
      data: updateData,
      include: {
        card: true,
        bids: {
          where: { is_active: true },
          orderBy: { amount: 'desc' },
          include: {
            bidder: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    // Create history entry for significant changes
    if (body.is_for_sale && !existingUserCard.is_for_sale) {
      await prisma.cardTransactionHistory.create({
        data: {
          userCardId: userCardId,
          toUserId: userId,
          action: 'LISTING',
          notes: `Listed for ${body.sale_type === 'FIXED' ? 'fixed price sale' : 'auction'}`,
        },
      });
    } else if (!body.is_for_sale && existingUserCard.is_for_sale) {
      await prisma.cardTransactionHistory.create({
        data: {
          userCardId: userCardId,
          toUserId: userId,
          action: 'DELISTING',
          notes: 'Removed from sale',
        },
      });
    }

    return NextResponse.json(updatedUserCard);
  } catch (error) {
    console.error('Error updating user card:', error);
    return NextResponse.json(
      {
        error: 'Failed to update card',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// DELETE /api/user-cards/[id] - Remove card from collection
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Always use real session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await context.params;
    const userCardId = parseInt(id);
    const userId = parseInt(session.user.id);

    // Verify user owns this card
    const userCard = await prisma.userCard.findFirst({
      where: {
        id: userCardId,
        owner_id: userId,
      },
    });

    if (!userCard) {
      return NextResponse.json(
        { error: 'Card not found or not owned by user' },
        { status: 404 },
      );
    }

    // Check if card has active bids
    const activeBids = await prisma.bid.count({
      where: {
        userCardId: userCardId,
        is_active: true,
      },
    });

    if (activeBids > 0) {
      return NextResponse.json(
        { error: 'Cannot delete card with active bids' },
        { status: 400 },
      );
    }

    // Perform deletion in transaction
    await prisma.$transaction(async (tx) => {
      // Deactivate any bids
      await tx.bid.updateMany({
        where: { userCardId: userCardId },
        data: { is_active: false },
      });

      // Create deletion history
      await tx.cardTransactionHistory.create({
        data: {
          userCardId: userCardId,
          toUserId: userId,
          action: 'DELETION',
          notes: 'Card removed from collection',
        },
      });

      // Delete the user card
      await tx.userCard.delete({
        where: { id: userCardId },
      });
    });

    return NextResponse.json({ message: 'Card removed from collection' });
  } catch (error) {
    console.error('Error deleting user card:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete card',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}