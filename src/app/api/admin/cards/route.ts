import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

// Types
interface CardFilter {
  name?: { contains: string; mode?: 'insensitive' };
  set_name?: string;
  card_type?: string;
}

interface CardData {
  name: string;
  set_name: string;
  set_number: string;
  rarity: string;
  card_type: string;
  subtype?: string | null;
  hp?: string | null;
  image_url?: string | null;
  small_image_url?: string | null;
  tcg_id?: string | null;
}

interface PrismaCard {
  id: number;
  name: string;
  set_name: string;
  set_number: string | null; // Change to nullable
  rarity: string;
  card_type: string | null; // Also nullable to match schema
  subtype: string | null;
  hp: number | null;
  image_url: string | null;
  small_image_url: string | null;
  tcg_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface BulkCreateResult {
  created: PrismaCard[];
  skipped: Array<{ card: CardData; reason: string }>;
  errors: Array<{ card: CardData; error: string }>;
}

const isAdmin = (user: unknown): user is { role: string } => {
  return typeof user === 'object' && user !== null && 'role' in user && (user as { role: unknown }).role === 'admin';
};

// GET /api/admin/cards
export async function GET(request: NextRequest) {
  try {
    const user = { id: 1, email: 'admin@test.com', name: 'Admin User', role: 'admin' };

    if (!isAdmin(user)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const search = searchParams.get('search') || '';
    const setName = searchParams.get('set') || '';
    const cardType = searchParams.get('type') || '';

    const skip = (page - 1) * limit;

    // Build Prisma where filter with correct typing
    const where: CardFilter = {};

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    if (setName) {
      where.set_name = setName;
    }

    if (cardType) {
      where.card_type = cardType;
    }

    // Fetch cards and count
    const [cards, totalCount] = await Promise.all([
      prisma.card.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          userCards: {
            select: {
              id: true,
              owner_id: true,
              is_for_sale: true,
              is_sold: true,
              condition: true
            }
          },
          _count: {
            select: {
              userCards: true
            }
          }
        }
      }),
      prisma.card.count({ where })
    ]);

    const cardsWithStats = cards.map(card => ({
      ...card,
      totalOwned: card._count.userCards,
      forSaleCount: card.userCards.filter(uc => uc.is_for_sale && !uc.is_sold).length,
      soldCount: card.userCards.filter(uc => uc.is_sold).length,
      uniqueOwners: new Set(card.userCards.map(uc => uc.owner_id)).size
    }));

    return NextResponse.json({
      cards: cardsWithStats,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error: unknown) {
    console.error('Error fetching admin cards:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch cards',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/admin/cards
export async function POST(request: NextRequest) {
  try {
    const user = { id: 1, email: 'admin@test.com', name: 'Admin User', role: 'admin' };

    if (!isAdmin(user)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body: CardData = await request.json();
    const {
      name,
      set_name,
      set_number,
      rarity,
      card_type,
      subtype,
      hp,
      image_url,
      small_image_url,
      tcg_id
    } = body;

    if (!name || !set_name || !set_number || !rarity || !card_type) {
      return NextResponse.json(
        { error: 'Missing required fields: name, set_name, set_number, rarity, card_type' },
        { status: 400 }
      );
    }

    const existingCard = await prisma.card.findFirst({
      where: { name, set_name, set_number }
    });

    if (existingCard) {
      return NextResponse.json({ error: 'Card already exists' }, { status: 409 });
    }

    const hpNumber = hp !== undefined && hp !== null && hp !== '' ? parseInt(hp, 10) : null;

    const newCard = await prisma.card.create({
      data: {
        name,
        set_name,
        set_number,
        rarity,
        card_type,
        subtype: subtype ?? null,
        hp: hpNumber,
        image_url: image_url ?? null,
        small_image_url: small_image_url ?? null,
        tcg_id: tcg_id ?? null
      },
      include: {
        _count: { select: { userCards: true } }
      }
    });

    return NextResponse.json(
      {
        ...newCard,
        totalOwned: 0,
        forSaleCount: 0,
        soldCount: 0,
        uniqueOwners: 0
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('Error creating card:', error);
    return NextResponse.json(
      {
        error: 'Failed to create card',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PUT /api/admin/cards/bulk
export async function PUT(request: NextRequest) {
  try {
    const user = { id: 1, email: 'admin@test.com', name: 'Admin User', role: 'admin' };

    if (!isAdmin(user)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { cards }: { cards: CardData[] } = body;

    if (!Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json({ error: 'Cards array is required and must not be empty' }, { status: 400 });
    }

    const results: BulkCreateResult = { created: [], skipped: [], errors: [] };

    for (const cardData of cards) {
      try {
        const {
          name,
          set_name,
          set_number,
          rarity,
          card_type,
          subtype,
          hp,
          image_url,
          small_image_url,
          tcg_id
        } = cardData;

        if (!name || !set_name || !set_number || !rarity || !card_type) {
          results.errors.push({ card: cardData, error: 'Missing required fields' });
          continue;
        }

        const existingCard = await prisma.card.findFirst({
          where: { name, set_name, set_number }
        });

        if (existingCard) {
          results.skipped.push({ card: cardData, reason: 'Card already exists' });
          continue;
        }

        const hpNumber = hp !== undefined && hp !== null && hp !== '' ? parseInt(hp, 10) : null;

        const newCard = await prisma.card.create({
          data: {
            name,
            set_name,
            set_number,
            rarity,
            card_type,
            subtype: subtype ?? null,
            hp: hpNumber,
            image_url: image_url ?? null,
            small_image_url: small_image_url ?? null,
            tcg_id: tcg_id ?? null
          }
        });

        results.created.push(newCard);
      } catch (error: unknown) {
        results.errors.push({ card: cardData, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return NextResponse.json(results, { status: 201 });
  } catch (error: unknown) {
    console.error('Error bulk creating cards:', error);
    return NextResponse.json(
      {
        error: 'Failed to bulk create cards',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
