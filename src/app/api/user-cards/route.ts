import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '../../lib/prisma';
import { Prisma } from '@prisma/client';

// GET /api/user-cards - Get user's card collection
export async function GET(request: NextRequest) {
  console.log('🔍 User-cards API called');
  try {
    const session = await getServerSession();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const forSale = searchParams.get('forSale') === 'true';

    const skip = (page - 1) * limit;

    // Build where clause with specific type
    const where: Prisma.UserCardWhereInput = {
      owner_id: user.id,
    };

    if (forSale) {
      where.is_for_sale = true;
      where.is_sold = false;
    }

    // Get user's cards (without includes that cause issues)
    const [userCards, totalCount] = await Promise.all([
      prisma.userCard.findMany({
        where,
        skip,
        take: limit,
        orderBy: { acquired_date: 'desc' },
      }),
      prisma.userCard.count({ where }),
    ]);

    // Get related data separately for each user card
    const enrichedUserCards = await Promise.all(
      userCards.map(async (userCard) => {
        // Get card details
        const card = await prisma.card.findUnique({
          where: { id: userCard.card_id }
        });

        // Get active bids
        const bids = await prisma.bid.findMany({
          where: {
            userCardId: userCard.id,
            is_active: true
          },
          orderBy: { amount: 'desc' }
        });

        // Get bidder details for each bid
        const bidsWithBidder = await Promise.all(
          bids.map(async (bid) => {
            const bidder = await prisma.user.findUnique({
              where: { id: bid.bidderId },
              select: { id: true, name: true }
            });
            return { ...bid, bidder };
          })
        );

        return {
          ...userCard,
          card,
          bids: bidsWithBidder
        };
      })
    );

    return NextResponse.json({
      userCards: enrichedUserCards,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching user cards:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user cards' },
      { status: 500 },
    );
  }
}

// POST /api/user-cards - Add card to user's collection (purchase)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { card_id, condition = 'NM', notes, purchase_price } = body;

    if (!card_id) {
      return NextResponse.json({ error: 'card_id is required' }, { status: 400 });
    }

    // Verify card exists
    const card = await prisma.card.findUnique({
      where: { id: card_id },
    });

    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Create user card and history record in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user card (without include that causes issues)
      const userCard = await tx.userCard.create({
        data: {
          card_id,
          owner_id: user.id,
          condition,
          notes,
        },
      });

      // Create history record
      await tx.cardTransactionHistory.create({
        data: {
          userCardId: userCard.id, // Fixed: user_card_id → userCardId
          toUserId: user.id, // Fixed: to_user_id → toUserId
          action: 'PURCHASE', // Fixed: transaction_type → action
          notes: purchase_price
            ? `Initial purchase - ${condition} condition for $${parseFloat(purchase_price).toFixed(2)}`
            : `Initial purchase - ${condition} condition`,
        },
      });

      // Get card details separately and return combined result
      const cardDetails = await tx.card.findUnique({
        where: { id: card_id }
      });

      return {
        ...userCard,
        card: cardDetails
      };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error adding card to collection:', error);
    return NextResponse.json(
      { error: 'Failed to add card to collection' },
      { status: 500 },
    );
  }
}