import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { requireAdmin } from '../../../lib/auth';

// Types
interface CardFilter {
  name?: { contains: string; mode?: 'insensitive' };
  set_name?: string;
  card_type?: string;
}

interface CardData {
  name: string;
  set_name: string;
  card_number: string; // Fixed: Changed from set_number to card_number
  rarity: string;
  card_type: string;
  
  hp?: string | null;
  image_url?: string | null;

}

interface PrismaCard {
  id: number;
  name: string;
  set_name: string;
  card_number: string | null;
  rarity: string;
  card_type: string | null;
  hp: number | null;
  image_url: string | null;
  price_tracker_id: string;
  set_id: string;
  source: string;
  created_at: Date;
  updated_at: Date; 
}

interface BulkCreateResult {
  created: PrismaCard[];
  skipped: Array<{ card: CardData; reason: string }>;
  errors: Array<{ card: CardData; error: string }>;
}

// GET /api/admin/cards
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ("response" in auth) return auth.response;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));

    // *** FIX: Increase default limit and add option to get ALL cards ***
    const requestedLimit = searchParams.get('limit');
    const getAllCards = searchParams.get('all') === 'true'; // New parameter to get all cards

    let limit: number;
    let skip: number;

    if (getAllCards) {
      // Get all cards - no pagination
      limit = undefined as any; // Will not use take
      skip = 0;
    } else {
      // Use pagination with higher default limit
      limit = Math.min(1000, Math.max(1, parseInt(requestedLimit || '100'))); // Default 100, max 1000
      skip = (page - 1) * limit;
    }

    const search = searchParams.get('search') || '';
    const setName = searchParams.get('set') || '';
    const cardType = searchParams.get('type') || '';

    console.log(`🔍 Admin Cards Query: page=${page}, limit=${limit || 'ALL'}, search="${search}"`);

    // Build Prisma where filter
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

    // *** FIX: Fetch cards with conditional pagination ***
    const cardsQuery = {
      where,
      orderBy: { created_at: 'desc' },
      ...(getAllCards ? {} : { skip, take: limit }) // Only add pagination if not getting all
    };

    const [cards, totalCount] = await Promise.all([
      prisma.card.findMany(cardsQuery as any),
      prisma.card.count({ where })
    ]);

    console.log(`📊 Found ${cards.length} cards out of ${totalCount} total`);

    // Get related user cards data separately (optimized)
    const cardIds = cards.map(card => card.id);
    const userCards = cardIds.length > 0 ? await prisma.userCard.findMany({
      where: {
        card_id: { in: cardIds }
      },
      select: {
        id: true,
        card_id: true,
        owner_id: true,
        is_for_sale: true,
        is_sold: true,
        condition: true
      }
    }) : [];

    // Group user cards by card_id for efficient lookup
    const userCardsByCardId = new Map<number, typeof userCards>();
    userCards.forEach(uc => {
      if (!userCardsByCardId.has(uc.card_id)) {
        userCardsByCardId.set(uc.card_id, []);
      }
      userCardsByCardId.get(uc.card_id)!.push(uc);
    });

    // Add stats to cards
    const cardsWithStats = cards.map(card => {
      const cardUserCards = userCardsByCardId.get(card.id) || [];

      return {
        ...card,
        totalOwned: cardUserCards.length,
        forSaleCount: cardUserCards.filter(uc => uc.is_for_sale && !uc.is_sold).length,
        soldCount: cardUserCards.filter(uc => uc.is_sold).length,
        uniqueOwners: new Set(cardUserCards.map(uc => uc.owner_id)).size,
        userCards: cardUserCards,
        _count: { userCards: cardUserCards.length }
      };
    });

    const response = {
      cards: cardsWithStats,
      pagination: {
        page: getAllCards ? 1 : page,
        limit: getAllCards ? totalCount : limit,
        total: totalCount,
        totalPages: getAllCards ? 1 : Math.ceil(totalCount / limit),
        hasNextPage: getAllCards ? false : (page * limit) < totalCount,
        hasPrevPage: getAllCards ? false : page > 1,
        showing: cards.length,
        getAllCards
      }
    };

    console.log(`✅ Returning ${cards.length} cards with pagination:`, response.pagination);

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error('❌ Error fetching admin cards:', error);
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
    const auth = await requireAdmin();
    if ("response" in auth) return auth.response;

    const body: CardData = await request.json();
    const {
      name,
      set_name,
      card_number, // Fixed: Changed from set_number to card_number
      rarity,
      card_type,
     
      hp,
      image_url,
      
      
    } = body;

    if (!name || !set_name || !card_number || !rarity || !card_type) {
      return NextResponse.json(
        { error: 'Missing required fields: name, set_name, card_number, rarity, card_type' },
        { status: 400 }
      );
    }

    const existingCard = await prisma.card.findFirst({
      where: { name, set_name, card_number } // Fixed: Changed from set_number to card_number
    });

    if (existingCard) {
      return NextResponse.json({ error: 'Card already exists' }, { status: 409 });
    }

    const hpNumber = hp !== undefined && hp !== null && hp !== '' ? parseInt(hp, 10) : null;

    // Create card without problematic include
    const newCard = await prisma.card.create({
      data: {
        name,
        set_name,
        card_number,
        rarity,
        card_type,
        hp: hpNumber,
        image_url: image_url ?? null,

        // Add required fields for manual card creation
        price_tracker_id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        set_id: 'manual',

        // Add other required schema fields
        source: 'MANUAL',
        sync_enabled: false,
        sync_errors: 0,
        last_updated: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    // Return card with stats (all zeros since it's new)
    return NextResponse.json(
      {
        ...newCard,
        totalOwned: 0,
        forSaleCount: 0,
        soldCount: 0,
        uniqueOwners: 0,
        userCards: [],
        _count: { userCards: 0 }
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
    const auth = await requireAdmin();
    if ("response" in auth) return auth.response;

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
          card_number, // Fixed: Changed from set_number to card_number
          rarity,
          card_type,
          
          hp,
          image_url,
          
          
        } = cardData;

        if (!name || !set_name || !card_number || !rarity || !card_type) {
          results.errors.push({ card: cardData, error: 'Missing required fields' });
          continue;
        }

        const existingCard = await prisma.card.findFirst({
          where: { name, set_name, card_number } // Fixed: Changed from set_number to card_number
        });

        if (existingCard) {
          results.skipped.push({ card: cardData, reason: 'Card already exists' });
          continue;
        }

        const hpNumber = hp !== undefined && hp !== null && hp !== '' ? parseInt(hp, 10) : null;

        // Create card without problematic include
        const newCard = await prisma.card.create({
          data: {
            name,
            set_name,
            card_number,
            rarity,
            card_type,
            hp: hpNumber,
            image_url: image_url ?? null,

            
            price_tracker_id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            set_id: 'manual',
            source: 'MANUAL',
            sync_enabled: false,
            sync_errors: 0,
            last_updated: new Date(),
            created_at: new Date(),
            updated_at: new Date()
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