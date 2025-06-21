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

    const card = await prisma.card.findUnique({
      where: { id: cardId },
      include: {
        userCards: {
          include: {
            owner: { select: { id: true, name: true, email: true } },
            bids: {
              where: { is_active: true },
              include: { bidder: { select: { id: true, name: true } } },
            },
          },
        },
        _count: { select: { userCards: true } },
      },
    });

    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    const cardWithStats = {
      ...card,
      totalOwned: card._count.userCards,
      forSaleCount: card.userCards.filter((uc) => uc.is_for_sale && !uc.is_sold).length,
      soldCount: card.userCards.filter((uc) => uc.is_sold).length,
      uniqueOwners: new Set(card.userCards.map((uc) => uc.owner_id)).size,
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

    const updatedCard = await prisma.card.update({
      where: { id: cardId },
      data: {
        name: body.name,
        set_name: body.set_name,
        set_number: body.set_number,
        rarity: body.rarity,
        card_type: body.card_type,
        subtype: body.subtype,
        hp: body.hp ?? null,
        image_url: body.image_url,
        small_image_url: body.small_image_url,
        tcg_id: body.tcg_id,
      },
      include: {
        _count: { select: { userCards: true } },
      },
    });

    const cardWithStats = {
      ...updatedCard,
      totalOwned: updatedCard._count.userCards,
      forSaleCount: 0,
      soldCount: 0,
      uniqueOwners: 0,
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

    const existingCard = await prisma.card.findUnique({
      where: { id: cardId },
      include: { userCards: true },
    });

    if (!existingCard) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    if (existingCard.userCards.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete card that is owned by users',
          details: `This card is owned by ${existingCard.userCards.length} user(s)`,
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
