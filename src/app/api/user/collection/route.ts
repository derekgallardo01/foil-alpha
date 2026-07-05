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

    // Get card details and related data separately
    const enrichedCollection = await Promise.all(
      userCards.map(async (userCard) => {
        // Get card details
        const card = await prisma.card.findUnique({
          where: { id: userCard.card_id }
        });

        // Get active bids for this user card
        const bids = await prisma.bid.findMany({
          where: {
            userCardId: userCard.id,
            is_active: true
          },
          orderBy: { amount: 'desc' },
          take: 1
        });

        // Get bidder details for the highest bid
        const highestBidder = bids.length > 0 ? await prisma.user.findUnique({
          where: { id: bids[0].bidderId },
          select: { id: true, name: true }
        }) : null;

        // Count total active bids
        const bidCount = await prisma.bid.count({
          where: {
            userCardId: userCard.id,
            is_active: true
          }
        });

        // Apply search filter if provided
        if (search && card) {
          const searchLower = search.toLowerCase();
          const matchesSearch =
            card.name.toLowerCase().includes(searchLower) ||
            card.set_name.toLowerCase().includes(searchLower) ||
            (card.card_type && card.card_type.toLowerCase().includes(searchLower));

          if (!matchesSearch) {
            return null; // Filter out non-matching cards
          }
        }

        // Get original purchase price from wallet transactions
        const originalPurchasePrice = getOriginalPurchasePrice(userCard);

        return {
          id: userCard.id,
          card: card ? {
            id: card.id,
            name: card.name,
            set_name: card.set_name,
            set_number: card.card_number,
            rarity: card.rarity,
            card_type: card.card_type,
            image_url: card.image_url,
            small_image_url: card.image_url,
            market_price: card.market_price ? Number(card.market_price) : null,
            price_trend: null,
            last_price_update: card.price_last_updated,
          } : null,
          condition: userCard.condition,
          is_for_sale: userCard.is_for_sale,
          sale_type: userCard.sale_type,
          fixed_price: userCard.fixed_price ? Number(userCard.fixed_price) : null,
          reserve_price: userCard.reserve_price ? Number(userCard.reserve_price) : null,
          auction_end: userCard.auction_end,
          is_sold: userCard.is_sold,
          notes: userCard.notes,
          acquired_date: userCard.acquired_date || userCard.created_at,
          original_purchase_price: originalPurchasePrice,
          bid_count: bidCount,
          highest_bid: bids.length > 0 ? Number(bids[0].amount) : null,
          highest_bidder: highestBidder,
        };
      })
    );

    // Filter out null results (from search filtering) and ensure type safety
    const filteredCollection = enrichedCollection.filter((item): item is NonNullable<typeof item> =>
      item !== null && item.card !== null
    );

    // Debug: Show some sample cards
    if (filteredCollection.length > 0) {
      console.log('Sample cards:', filteredCollection.slice(0, 3).map(uc => ({
        id: uc.id,
        cardName: uc.card?.name,
        ownerId: userId,
        acquiredDate: uc.acquired_date
      })));
    } else {
      console.log('⚠️ No cards found for user. Checking if user has purchased any cards...');

      // Debug: Check wallet transactions to see if user made purchases
      const purchases = await prisma.walletTransaction.findMany({
        where: {
          user_id: userId,
          transaction_type: { in: ['PURCHASE', 'CATALOG_PURCHASE'] }
        },
        take: 5,
        orderBy: { created_at: 'desc' }
      });

      console.log(`User has ${purchases.length} purchase transactions:`,
        purchases.map(p => ({
          type: p.transaction_type,
          amount: p.amount,
          description: p.description,
          date: p.created_at
        }))
      );
    }

    // Adjust pagination based on filtered results
    const finalTotal = search ? filteredCollection.length : totalCount;

    return NextResponse.json({
      cards: filteredCollection,
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