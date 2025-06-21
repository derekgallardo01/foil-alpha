import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
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
export async function GET(request: NextRequest, context: unknown) {
  try {
    const params = (context as { params: { id: string } }).params;
    const userCardId = parseInt(params.id);

    const userCard = await prisma.userCard.findUnique({
      where: { id: userCardId },
      include: {
        card: true,
        owner: {
          select: { id: true, name: true, email: true },
        },
        bids: {
          where: { is_active: true },
          orderBy: { amount: 'desc' },
          include: {
            bidder: {
              select: { id: true, name: true },
            },
          },
        },
        history: { // Changed from 'cardHistory' to 'history'
          orderBy: { created_at: 'desc' },
          include: {
            fromUser: {
              select: { id: true, name: true },
            },
            toUser: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!userCard) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    return NextResponse.json(userCard);
  } catch (error) {
    console.error('Error fetching user card:', error);
    return NextResponse.json(
      { error: 'Failed to fetch card details' },
      { status: 500 }
    );
  }
}

// PUT /api/user-cards/[id] - Update user's card (listing, condition, notes)
export async function PUT(request: NextRequest, context: unknown) {
  try {
    const params = (context as { params: { id: string } }).params;
    const userCardId = parseInt(params.id);
    const session = await getServerSession();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();

    // Verify user owns this card
    const existingUserCard = await prisma.userCard.findFirst({
      where: {
        id: userCardId,
        owner_id: user.id,
      },
    });

    if (!existingUserCard) {
      return NextResponse.json(
        { error: 'Card not found or not owned by user' },
        { status: 404 }
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
        const auctionDurationHours = parseInt(body.auction_duration_hours || '168'); // Default 7 days
        const auctionEnd = new Date();
        auctionEnd.setHours(auctionEnd.getHours() + auctionDurationHours);

        updateData.reserve_price = parseFloat(body.reserve_price);
        updateData.fixed_price = null;
        updateData.auction_end = auctionEnd;

        // Cancel any existing bids if re-listing
        await prisma.bid.updateMany({
          where: {
            user_card_id: userCardId,
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
          user_card_id: userCardId,
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
      await prisma.cardHistory.create({
        data: {
          user_card_id: userCardId,
          to_user_id: user.id,
          transaction_type: 'LISTING',
          price:
            body.sale_type === 'FIXED'
              ? parseFloat(body.fixed_price)
              : parseFloat(body.reserve_price),
          notes: `Listed for ${
            body.sale_type === 'FIXED' ? 'fixed price sale' : 'auction'
          }`,
        },
      });
    } else if (!body.is_for_sale && existingUserCard.is_for_sale) {
      await prisma.cardHistory.create({
        data: {
          user_card_id: userCardId,
          to_user_id: user.id,
          transaction_type: 'DELISTING',
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
      { status: 500 }
    );
  }
}

// DELETE /api/user-cards/[id] - Remove card from collection (admin only or special cases)
export async function DELETE(request: NextRequest, context: unknown) {
  try {
    const params = (context as { params: { id: string } }).params;
    const userCardId = parseInt(params.id);
    const session = await getServerSession();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify user owns this card
    const userCard = await prisma.userCard.findFirst({
      where: {
        id: userCardId,
        owner_id: user.id,
      },
    });

    if (!userCard) {
      return NextResponse.json(
        { error: 'Card not found or not owned by user' },
        { status: 404 }
      );
    }

    // Check if card has active bids
    const activeBids = await prisma.bid.count({
      where: {
        user_card_id: userCardId,
        is_active: true,
      },
    });

    if (activeBids > 0) {
      return NextResponse.json(
        { error: 'Cannot delete card with active bids' },
        { status: 400 }
      );
    }

    // Perform deletion in transaction
    await prisma.$transaction(async (tx) => {
      // Deactivate any bids
      await tx.bid.updateMany({
        where: { user_card_id: userCardId },
        data: { is_active: false },
      });

      // Create deletion history
      await tx.cardHistory.create({
        data: {
          user_card_id: userCardId,
          to_user_id: user.id,
          transaction_type: 'DELETION',
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
      { status: 500 }
    );
  }
}