import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../auth/[...nextauth]/route';
import { prisma } from '../../../../../lib/prisma';

// Interface for update data
interface UpdateData {
  is_for_sale: boolean;
  sale_type: 'FIXED' | 'AUCTION' | null;
  fixed_price?: number | null;
  reserve_price?: number | null;
  auction_end?: Date | null;
}

// POST /api/user/collection/[id]/sell - List a card for sale
export async function POST(request: NextRequest, context: unknown) {
  try {
    const params = (context as { params: { id: string } }).params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const userCardId = parseInt(params.id);
    const body = await request.json();
    const { sale_type, fixed_price, reserve_price, auction_duration_hours } = body;

    // Validate sale type
    if (!['FIXED', 'AUCTION'].includes(sale_type)) {
      return NextResponse.json({ error: 'sale_type must be FIXED or AUCTION' }, { status: 400 });
    }

    // Validate required fields based on sale type
    if (sale_type === 'FIXED' && (!fixed_price || fixed_price <= 0)) {
      return NextResponse.json({ error: 'fixed_price is required for fixed price sales' }, { status: 400 });
    }

    if (sale_type === 'AUCTION') {
      if (reserve_price === undefined || reserve_price < 0) {
        return NextResponse.json({ error: 'reserve_price is required for auctions' }, { status: 400 });
      }
      if (!auction_duration_hours || auction_duration_hours < 1 || auction_duration_hours > 168) {
        return NextResponse.json({ error: 'auction_duration_hours must be between 1 and 168 (7 days)' }, { status: 400 });
      }
    }

    // Get the card
    const userCard = await prisma.userCard.findUnique({
      where: { id: userCardId }
    });

    if (!userCard) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Verify ownership
    if (userCard.owner_id !== userId) {
      return NextResponse.json({ error: 'You can only sell your own cards' }, { status: 403 });
    }

    // Check if already for sale
    if (userCard.is_for_sale) {
      return NextResponse.json({ error: 'Card is already listed for sale' }, { status: 400 });
    }

    // Check if already sold
    if (userCard.is_sold) {
      return NextResponse.json({ error: 'Card has already been sold' }, { status: 400 });
    }

    // Get card details for response
    const card = await prisma.card.findUnique({
      where: { id: userCard.card_id }
    });

    if (!card) {
      return NextResponse.json({ error: 'Card details not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: UpdateData = {
      is_for_sale: true,
      sale_type,
    };

    if (sale_type === 'FIXED') {
      updateData.fixed_price = Number(fixed_price);
      updateData.reserve_price = null;
      updateData.auction_end = null;
    } else if (sale_type === 'AUCTION') {
      updateData.fixed_price = null;
      updateData.reserve_price = Number(reserve_price);
      updateData.auction_end = new Date(Date.now() + Number(auction_duration_hours) * 60 * 60 * 1000);
    }

    // Update the card
    await prisma.userCard.update({
      where: { id: userCardId },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      message: `Card listed for ${sale_type.toLowerCase()} sale`,
      listing: {
        id: userCardId,
        card_name: card.name,
        sale_type: sale_type,
        price: sale_type === 'FIXED' ? Number(fixed_price) : Number(reserve_price),
        auction_end: updateData.auction_end
      }
    });

  } catch (error) {
    console.error('Error listing card for sale:', error);
    return NextResponse.json(
      {
        error: 'Failed to list card for sale',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE /api/user/collection/[id]/sell - Remove card from sale
export async function DELETE(request: NextRequest, context: unknown) {
  try {
    const params = (context as { params: { id: string } }).params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const userCardId = parseInt(params.id);

    // Get the card
    const userCard = await prisma.userCard.findUnique({
      where: { id: userCardId }
    });

    if (!userCard) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Verify ownership
    if (userCard.owner_id !== userId) {
      return NextResponse.json({ error: 'You can only manage your own cards' }, { status: 403 });
    }

    // Check if not for sale
    if (!userCard.is_for_sale) {
      return NextResponse.json({ error: 'Card is not currently for sale' }, { status: 400 });
    }

    // Check if has active bids (for auctions)
    if (userCard.sale_type === 'AUCTION') {
      const activeBids = await prisma.bid.count({
        where: {
          user_card_id: userCardId,
          is_active: true
        }
      });

      if (activeBids > 0) {
        return NextResponse.json({
          error: 'Cannot remove auction with active bids'
        }, { status: 400 });
      }
    }

    // Get card details for response
    const card = await prisma.card.findUnique({
      where: { id: userCard.card_id }
    });

    // Remove from sale
    await prisma.userCard.update({
      where: { id: userCardId },
      data: {
        is_for_sale: false,
        sale_type: null,
        fixed_price: null,
        reserve_price: null,
        auction_end: null
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Card removed from sale',
      card_name: card?.name || 'Unknown'
    });

  } catch (error) {
    console.error('Error removing card from sale:', error);
    return NextResponse.json(
      {
        error: 'Failed to remove card from sale',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}