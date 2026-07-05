import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

// Force dynamic rendering (optional, ensures fresh data)
export const dynamic = 'force-dynamic';

interface CardUpdateData {
  name: string;
  set_name: string;
  set_number: string;
  rarity: string;
  card_type: string;
  subtype?: string;
  hp?: number;
  image_url?: string;
  small_image_url?: string;
  tcg_id?: string;
}

interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'user';
}

const getCardIdFromRequest = (req: NextRequest): number | null => {
  const match = req.nextUrl.pathname.match(/\/cards\/([^/]+)$/);
  const id = match?.[1];
  if (!id || isNaN(Number(id))) return null;
  return parseInt(id);
};

const getSimulatedUser = (): User => ({
  id: 1,
  email: 'admin@test.com',
  name: 'Admin User',
  role: 'admin',
});

const isAdmin = (user: User | null) => user && user.role === 'admin';

// GET /api/admin/cards/[id]
export async function GET(req: NextRequest) {
  const cardId = getCardIdFromRequest(req);
  if (!cardId) {
    return NextResponse.json({ error: 'Invalid card ID' }, { status: 400 });
  }

  try {
    const user = getSimulatedUser();
    if (!isAdmin(user)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get card without problematic includes
    const card = await prisma.card.findUnique({
      where: { id: cardId }
    });

    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Get user cards for this card
    const userCards = await prisma.userCard.findMany({
      where: { card_id: cardId },
      select: {
        id: true,
        owner_id: true,
        card_id: true,
        condition: true,
        is_for_sale: true,
        sale_type: true,
        fixed_price: true,
        reserve_price: true,
        auction_end: true,
        is_sold: true,
        notes: true,
        acquired_date: true,
        created_at: true
      }
    });

    // Get unique owner IDs and user card IDs
    const ownerIds = [...new Set(userCards.map(uc => uc.owner_id))];
    const userCardIds = userCards.map(uc => uc.id);

    // Get related data separately
    const [owners, allBids] = await Promise.all([
      // Get owners
      ownerIds.length > 0 ? prisma.user.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, name: true, email: true }
      }) : [],
      // Get bids for these user cards
      userCardIds.length > 0 ? prisma.bid.findMany({
        where: {
          userCardId: { in: userCardIds },
          is_active: true
        },
        select: {
          id: true,
          userCardId: true,
          bidderId: true,
          amount: true,
          is_active: true,
          createdAt: true
        }
      }) : []
    ]);

    // Get bidders for the bids
    const bidderIds = [...new Set(allBids.map(bid => bid.bidderId))];
    const bidders = bidderIds.length > 0 ? await prisma.user.findMany({
      where: { id: { in: bidderIds } },
      select: { id: true, name: true }
    }) : [];

    // Create lookup maps
    const ownerMap = new Map(owners.map(o => [o.id, o]));
    const bidderMap = new Map(bidders.map(b => [b.id, b]));

    // Group bids by user card ID
    const bidsByUserCard = new Map();
    allBids.forEach(bid => {
      if (!bidsByUserCard.has(bid.userCardId)) {
        bidsByUserCard.set(bid.userCardId, []);
      }
      bidsByUserCard.get(bid.userCardId).push({
        id: bid.id,
        amount: Number(bid.amount),
        is_active: bid.is_active,
        createdAt: bid.createdAt,
        bidder: bidderMap.get(bid.bidderId)
      });
    });

    // Combine user cards with their related data
    const userCardsWithRelations = userCards.map(uc => ({
      ...uc,
      owner: ownerMap.get(uc.owner_id),
      bids: bidsByUserCard.get(uc.id) || []
    }));

    const cardWithStats = {
      ...card,
      userCards: userCardsWithRelations,
      _count: { userCards: userCards.length },
      totalOwned: userCards.length,
      forSaleCount: userCards.filter((uc) => uc.is_for_sale && !uc.is_sold).length,
      soldCount: userCards.filter((uc) => uc.is_sold).length,
      uniqueOwners: new Set(userCards.map((uc) => uc.owner_id)).size,
    };

    return NextResponse.json(cardWithStats);
  } catch (error) {
    console.error('Error fetching card:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch card',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// PUT /api/admin/cards/[id]
export async function PUT(req: NextRequest) {
  const cardId = getCardIdFromRequest(req);
  if (!cardId) {
    return NextResponse.json({ error: 'Invalid card ID' }, { status: 400 });
  }

  try {
    const user = getSimulatedUser();
    if (!isAdmin(user)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = (await req.json()) as CardUpdateData;

    const requiredFields: (keyof CardUpdateData)[] = [
      'name',
      'set_name',
      'set_number',
      'rarity',
      'card_type',
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    const existingCard = await prisma.card.findUnique({ where: { id: cardId } });
    if (!existingCard) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Update card without problematic include
    const updatedCard = await prisma.card.update({
      where: { id: cardId },
      data: {
        name: body.name,
        set_name: body.set_name,
        card_number: body.set_number,
        rarity: body.rarity,
        card_type: body.card_type,
        hp: body.hp ?? null,
        image_url: body.image_url,
        tcg_player_id: body.tcg_id,
      }
    });

    // Get user cards count separately
    const userCardsCount = await prisma.userCard.count({
      where: { card_id: cardId }
    });

    const cardWithStats = {
      ...updatedCard,
      _count: { userCards: userCardsCount },
      totalOwned: userCardsCount,
      forSaleCount: 0, // We could calculate this if needed
      soldCount: 0,    // We could calculate this if needed
      uniqueOwners: 0, // We could calculate this if needed
    };

    return NextResponse.json(cardWithStats);
  } catch (error) {
    console.error('Error updating card:', error);
    return NextResponse.json(
      {
        error: 'Failed to update card',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/cards/[id]
export async function DELETE(req: NextRequest) {
  const cardId = getCardIdFromRequest(req);
  if (!cardId) {
    return NextResponse.json({ error: 'Invalid card ID' }, { status: 400 });
  }

  try {
    const user = getSimulatedUser();
    if (!isAdmin(user)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Check if card exists
    const existingCard = await prisma.card.findUnique({
      where: { id: cardId }
    });

    if (!existingCard) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Check user cards separately to avoid include issues
    const userCards = await prisma.userCard.findMany({
      where: { card_id: cardId },
      select: { id: true }
    });

    if (userCards.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete card that is owned by users',
          details: `This card is owned by ${userCards.length} user(s)`,
        },
        { status: 400 }
      );
    }

    await prisma.card.delete({ where: { id: cardId } });
    return NextResponse.json({ message: 'Card deleted successfully' });
  } catch (error) {
    console.error('Error deleting card:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete card',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}