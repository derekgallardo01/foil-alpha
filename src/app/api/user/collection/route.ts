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
      whereClause.card = {
        OR: [
          { name: { contains: search } },
          { set_name: { contains: search } },
          { card_type: { contains: search } }
        ]
      };
    }

    if (forSale === 'true') {
      whereClause.is_for_sale = true;
    } else if (forSale === 'false') {
      whereClause.is_for_sale = false;
    }

    console.log('Collection query filter:', whereClause);

    // Get user's cards with full details
    const [userCards, totalCount] = await Promise.all([
      prisma.userCard.findMany({
        where: whereClause,
        include: {
          card: {
            include: {
              pokemonSet: true,
              rarity_ref: true,
              subtype_ref: true,
              supertype_ref: true,
            }
          },
          bids: {
            where: { is_active: true },
            orderBy: { amount: 'desc' },
            take: 1,
            include: {
              bidder: { select: { id: true, name: true } }
            }
          },
          _count: {
            select: { bids: { where: { is_active: true } } }
          }
        },
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

    // Debug: Show some sample cards
    if (userCards.length > 0) {
      console.log('Sample cards:', userCards.slice(0, 3).map(uc => ({
        id: uc.id,
        cardName: uc.card.name,
        ownerId: uc.owner_id,
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

    // Format the response
    const enrichedCollection = userCards.map(userCard => {
      // Get original purchase price from wallet transactions
      const originalPurchasePrice = getOriginalPurchasePrice(userCard);

      return {
        id: userCard.id,
        card: {
          id: userCard.card.id,
          name: userCard.card.name,
          set_name: userCard.card.set_name,
          set_number: userCard.card.set_number,
          rarity: userCard.card.rarity,
          card_type: userCard.card.card_type,
          image_url: userCard.card.image_url,
          small_image_url: userCard.card.small_image_url,
          market_price: userCard.card.market_price ? Number(userCard.card.market_price) : null,
          price_trend: userCard.card.price_trend,
          last_price_update: userCard.card.last_price_update,
        },
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
        bid_count: userCard._count.bids,
        highest_bid: userCard.bids[0] ? Number(userCard.bids[0].amount) : null,
        highest_bidder: userCard.bids[0]?.bidder || null,
      };
    });

    return NextResponse.json({
      cards: enrichedCollection,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
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