// src/app/api/user/collection/route.ts - Fixed to use real session
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '../../../lib/prisma';

// GET /api/user/collection - Get user's card collection
export async function GET(request: NextRequest) {
  try {
    // Always use real session for collection (ignore dev mode)
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required. Please log in.' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const userName = session.user.name || 'Unknown User';
    const userEmail = session.user.email || 'unknown';

    console.log(`📦 Fetching collection for: ${userName} (${userEmail}) - ID: ${userId}`);

    // Get URL parameters for filtering
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const forSale = searchParams.get('for_sale'); // 'true', 'false', or null
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const skip = (page - 1) * limit;

    // Build filter - ONLY show cards owned by current user
    const whereClause: any = {
      owner_id: userId, // CRITICAL: Only cards owned by this user
    };

    // Add additional filters
    if (search) {
      // For search, we'll need to fetch card details separately
      // For now, let's keep it simple and filter by user cards only
    }

    if (forSale === 'true') {
      whereClause.is_for_sale = true;
    } else if (forSale === 'false') {
      whereClause.is_for_sale = false;
    }

    console.log('Collection query filter:', whereClause);

    // Get user's cards (without includes that cause issues)
    const [userCards, totalCount] = await Promise.all([
      prisma.userCard.findMany({
        where: whereClause,
        orderBy: [
          { acquired_date: 'desc' },
          { created_at: 'desc' }
        ],
        skip,
        take: limit
      }),
      prisma.userCard.count({ where: whereClause })
    ]);

    console.log(`✅ Found ${userCards.length} cards in ${userName}'s collection (${totalCount} total)`);

    // Batch-load card details + active bids in bulk (avoids the previous N+1:
    // ~4 queries per card, which was ~900 round-trips for a 232-item collection).
    const cardIds = [...new Set(userCards.map((uc) => uc.card_id))];
    const cards = cardIds.length
      ? await prisma.card.findMany({ where: { id: { in: cardIds } } })
      : [];
    const cardById = new Map(cards.map((c) => [c.id, c]));

    const userCardIds = userCards.map((uc) => uc.id);
    const activeBids = userCardIds.length
      ? await prisma.bid.findMany({
          where: { userCardId: { in: userCardIds }, is_active: true },
          orderBy: { amount: 'desc' },
        })
      : [];
    const bidsByUserCard = new Map<number, typeof activeBids>();
    for (const bid of activeBids) {
      const list = bidsByUserCard.get(bid.userCardId) ?? [];
      list.push(bid);
      bidsByUserCard.set(bid.userCardId, list);
    }
    const bidderIds = [...new Set(activeBids.map((b) => b.bidderId))];
    const bidders = bidderIds.length
      ? await prisma.user.findMany({ where: { id: { in: bidderIds } }, select: { id: true, name: true } })
      : [];
    const bidderById = new Map(bidders.map((u) => [u.id, u]));

    const searchLower = search.toLowerCase();
    const enrichedCollection = userCards.map((userCard) => {
      const card = cardById.get(userCard.card_id) ?? null;
      if (!card) return null;

      // Apply search filter if provided (name / set / type / TCG)
      if (search) {
        const matchesSearch =
          card.name.toLowerCase().includes(searchLower) ||
          card.set_name.toLowerCase().includes(searchLower) ||
          (card.card_type?.toLowerCase().includes(searchLower) ?? false) ||
          (card.tcg?.toLowerCase().includes(searchLower) ?? false);
        if (!matchesSearch) return null;
      }

      const cardBids = bidsByUserCard.get(userCard.id) ?? [];

      return {
        id: userCard.id,
        card: {
          id: card.id,
          name: card.name,
          set_name: card.set_name,
          set_number: card.card_number,
          rarity: card.rarity,
          card_type: card.card_type,
          product_type: card.product_type,
          tcg: card.tcg,
          image_url: card.image_url,
          small_image_url: card.image_url,
          market_price: card.market_price ? Number(card.market_price) : null,
          price_trend: null,
          last_price_update: card.price_last_updated,
        },
        condition: userCard.condition,
        quantity: userCard.quantity ?? 1,
        is_graded: userCard.is_graded ?? false,
        grade_label: userCard.grade_label ?? null,
        is_for_sale: userCard.is_for_sale,
        sale_type: userCard.sale_type,
        fixed_price: userCard.fixed_price ? Number(userCard.fixed_price) : null,
        reserve_price: userCard.reserve_price ? Number(userCard.reserve_price) : null,
        auction_end: userCard.auction_end,
        is_sold: userCard.is_sold,
        notes: userCard.notes,
        acquired_date: userCard.acquired_date || userCard.created_at,
        original_purchase_price: getOriginalPurchasePrice(userCard),
        acquired_market_price: userCard.acquired_market_price ? Number(userCard.acquired_market_price) : null,
        bid_count: cardBids.length,
        highest_bid: cardBids.length > 0 ? Number(cardBids[0].amount) : null,
        highest_bidder: cardBids.length > 0 ? (bidderById.get(cardBids[0].bidderId) ?? null) : null,
      };
    });

    // Filter out null results (from search filtering) and ensure type safety
    const filteredCollection = enrichedCollection.filter((item): item is NonNullable<typeof item> =>
      item !== null && item.card !== null
    );

    // Whole-collection summary (independent of pagination / search) — powers the
    // stat tiles here and the collection stats on the dashboard.
    const summaryRows = await prisma.$queryRaw<Array<{
      n_lines: bigint; n_units: bigint; total_value: unknown; n_graded: bigint; n_sealed: bigint; n_cards: bigint;
    }>>`
      SELECT COUNT(*) AS n_lines,
             COALESCE(SUM(uc.quantity), 0) AS n_units,
             COALESCE(SUM(c.market_price * uc.quantity), 0) AS total_value,
             COALESCE(SUM(uc.is_graded), 0) AS n_graded,
             COALESCE(SUM(c.product_type = 'SEALED'), 0) AS n_sealed,
             COALESCE(SUM(c.product_type = 'CARD'), 0) AS n_cards
      FROM user_cards uc JOIN cards c ON c.id = uc.card_id
      WHERE uc.owner_id = ${userId}`;
    const s = summaryRows[0];
    const toNum = (v: unknown) => Number(String(v ?? 0)) || 0;
    const summary = {
      totalLines: toNum(s?.n_lines),
      totalUnits: toNum(s?.n_units),
      totalValue: toNum(s?.total_value),
      cardCount: toNum(s?.n_cards),
      sealedCount: toNum(s?.n_sealed),
      gradedCount: toNum(s?.n_graded),
    };

    // Adjust pagination based on filtered results
    const finalTotal = search ? filteredCollection.length : totalCount;

    return NextResponse.json({
      cards: filteredCollection,
      summary,
      // Back-compat fields consumed by the dashboard stat cards.
      totalValue: summary.totalValue,
      totalCards: summary.totalUnits,
      pagination: {
        page,
        limit,
        total: finalTotal,
        totalPages: Math.ceil(finalTotal / limit)
      },
      user: {
        id: userId,
        name: userName,
        email: userEmail
      }
    });

  } catch (error) {
    console.error('❌ Error fetching user collection:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch collection',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper function to get original purchase price
function getOriginalPurchasePrice(userCard: any): number | null {
  // Try to extract price from notes (if it was stored there)
  if (userCard.notes) {
    const priceMatch = userCard.notes.match(/\$(\d+\.?\d*)/);
    if (priceMatch) {
      return parseFloat(priceMatch[1]);
    }
  }

  // Default fallback
  return null;
}