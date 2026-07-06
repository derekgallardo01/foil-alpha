import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '../../lib/auth';
import { prisma } from '../../lib/prisma';
import { Prisma } from '@prisma/client';

// GET /api/user-cards - Get user's card collection or auctions
export async function GET(request: NextRequest) {
  console.log('🔍 User-cards API called');
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const user = auth.user;

    const userId = user.id;
    const { searchParams } = new URL(request.url);

    // Check if this is for "my auctions" page
    const myAuctions = searchParams.get('my_auctions') === 'true';

    if (myAuctions) {
      return await getMyAuctions(userId);
    }

    // Regular user cards functionality
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const forSale = searchParams.get('forSale') === 'true';

    const skip = (page - 1) * limit;

    // Build where clause with specific type
    const where: Prisma.UserCardWhereInput = {
      owner_id: userId,
    };

    if (forSale) {
      where.is_for_sale = true;
      where.is_sold = false;
    }

    // Get user's cards
    const [userCards, totalCount] = await Promise.all([
      prisma.userCard.findMany({
        where,
        skip,
        take: limit,
        orderBy: { acquired_date: 'desc' },
      }),
      prisma.userCard.count({ where }),
    ]);

    // Batch-load card details + active bids + bidders (avoids the per-card N+1).
    const cardIds = [...new Set(userCards.map((uc) => uc.card_id))];
    const cards = cardIds.length
      ? await prisma.card.findMany({
          where: { id: { in: cardIds } },
          select: { id: true, name: true, set_name: true, card_number: true, rarity: true, image_url: true },
        })
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
      ? await prisma.user.findMany({ where: { id: { in: bidderIds } }, select: { id: true, name: true, email: true } })
      : [];
    const bidderById = new Map(bidders.map((u) => [u.id, u]));

    const enrichedUserCards = userCards.map((userCard) => {
      const card = cardById.get(userCard.card_id) ?? null;
      const bidsWithBidder = (bidsByUserCard.get(userCard.id) ?? []).map((bid) => ({
        ...bid,
        bidder: bidderById.get(bid.bidderId) || { id: 0, name: 'Unknown', email: '' },
        amount: Number(bid.amount),
        created_at: bid.createdAt.toISOString(),
      }));
      return {
        ...userCard,
        card: card ? {
          ...card,
          set_number: card.card_number, // Map card_number to set_number for frontend
          small_image_url: card.image_url // Use same image for both
        } : null,
        bids: bidsWithBidder,
      };
    });

    return NextResponse.json({
      userCards: enrichedUserCards.filter(uc => uc.card !== null),
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

// NEW: Function to handle My Auctions specifically
async function getMyAuctions(userId: number) {
  try {
    console.log(`Fetching auctions for user ${userId}`);

    // Get user's auction cards
    const auctionCards = await prisma.userCard.findMany({
      where: {
        owner_id: userId,
        sale_type: 'AUCTION' // Only auction type
      },
      orderBy: { created_at: 'desc' },
      take: 50 // Limit results
    });

    console.log(`Found ${auctionCards.length} auction cards`);

    // Process each auction with related data
    const auctionsWithDetails = await Promise.all(
      auctionCards.map(async (userCard) => {
        try {
          // Get card details
          const card = await prisma.card.findUnique({
            where: { id: userCard.card_id },
            select: {
              id: true,
              name: true,
              set_name: true,
              card_number: true, // FIXED: Use card_number
              rarity: true,
              image_url: true
            }
          });

          if (!card) {
            console.warn(`Card not found for userCard ${userCard.id}`);
            return null;
          }

          // Get all bids for this auction
          const bids = await prisma.bid.findMany({
            where: {
              userCardId: userCard.id,
              is_active: true
            },
            orderBy: { amount: 'desc' }
          });

          // Get bidder details for each bid
          const bidsWithBidders = await Promise.all(
            bids.map(async (bid) => {
              const bidder = await prisma.user.findUnique({
                where: { id: bid.bidderId },
                select: { id: true, name: true, email: true }
              });

              return {
                id: bid.id,
                amount: Number(bid.amount),
                bidder: bidder || { id: 0, name: 'Unknown', email: '' },
                created_at: bid.createdAt.toISOString(),
                is_active: bid.is_active
              };
            })
          );

          // Calculate time remaining
          const now = new Date();
          const auctionEnd = userCard.auction_end ? new Date(userCard.auction_end) : null;
          const timeRemaining = auctionEnd ? Math.max(0, auctionEnd.getTime() - now.getTime()) : null;
          const highestBid = bidsWithBidders.length > 0 ? bidsWithBidders[0].amount : null;

          return {
            id: userCard.id,
            card: {
              id: card.id,
              name: card.name,
              set_name: card.set_name,
              set_number: card.card_number, // FIXED: Map card_number to set_number
              rarity: card.rarity,
              image_url: card.image_url,
              small_image_url: card.image_url // Use same image for both
            },
            condition: userCard.condition || 'Unknown',
            reserve_price: userCard.reserve_price ? Number(userCard.reserve_price) : 0,
            auction_end: userCard.auction_end?.toISOString() || '',
            is_sold: userCard.is_sold,
            is_for_sale: userCard.is_for_sale,
            time_remaining: timeRemaining,
            bids: bidsWithBidders,
            highest_bid: highestBid,
            bid_count: bidsWithBidders.length
          };
        } catch (error) {
          console.error(`Error processing auction ${userCard.id}:`, error);
          return null;
        }
      })
    );

    // Filter out null results
    const validAuctions = auctionsWithDetails.filter(auction => auction !== null);

    console.log(`Processed ${validAuctions.length} valid auctions`);

    return NextResponse.json(validAuctions);

  } catch (error) {
    console.error('Error fetching my auctions:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch auctions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/user-cards - Add card to user's collection (purchase)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const user = auth.user;

    const userId = user.id;
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
      // Create user card
      const userCard = await tx.userCard.create({
        data: {
          card_id,
          owner_id: userId,
          condition,
          notes,
        },
      });

      // Create history record
      await tx.cardTransactionHistory.create({
        data: {
          userCardId: userCard.id,
          toUserId: userId,
          action: 'PURCHASE',
          notes: purchase_price
            ? `Initial purchase - ${condition} condition for $${parseFloat(purchase_price).toFixed(2)}`
            : `Initial purchase - ${condition} condition`,
        },
      });

      // Get card details separately and return combined result
      const cardDetails = await tx.card.findUnique({
        where: { id: card_id },
        select: {
          id: true,
          name: true,
          set_name: true,
          card_number: true,
          rarity: true,
          image_url: true
        }
      });

      return {
        ...userCard,
        card: cardDetails ? {
          ...cardDetails,
          set_number: cardDetails.card_number, // Map for frontend compatibility
          small_image_url: cardDetails.image_url
        } : null
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