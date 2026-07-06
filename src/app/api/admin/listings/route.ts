import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { requireAdmin } from '../../../lib/auth';

// Interface for the where clause in GET request
interface WhereClause {
  owner_id: number;
  sale_type?: string;
  is_for_sale?: boolean;
  is_sold?: boolean;
}

// Interface for listing data in POST request
interface ListingData {
  card_id: number;
  owner_id: number;
  condition: string;
  is_for_sale: boolean;
  sale_type: 'FIXED' | 'AUCTION';
  notes: string;
  fixed_price?: number;
  reserve_price?: number | null;
  auction_end?: Date;
}

// Interface for POST request body
interface CreateListingBody {
  card_id: number | string;
  condition: string;
  sale_type: 'FIXED' | 'AUCTION';
  fixed_price?: number | string;
  reserve_price?: number | string | null;
  auction_duration_hours?: number | string;
  notes?: string;
  quantity?: number;
}

// GET /api/admin/listings - Get all admin marketplace listings
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ("response" in auth) return auth.response;
    const user = auth.user;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const search = searchParams.get('search') || '';
    const saleType = searchParams.get('saleType') || '';
    const status = searchParams.get('status') || '';

    const skip = (page - 1) * limit;

    // Build where clause for user cards (admin owned)
    const where: WhereClause = {
      owner_id: user.id, // Direct owner_id filter instead of relationship
    };

    if (saleType) {
      where.sale_type = saleType;
    }

    if (status === 'active') {
      where.is_for_sale = true;
      where.is_sold = false;
    } else if (status === 'sold') {
      where.is_sold = true;
    } else if (status === 'inactive') {
      where.is_for_sale = false;
      where.is_sold = false;
    }

    // Get listings without problematic includes
    const [listings, totalCount] = await Promise.all([
      prisma.userCard.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.userCard.count({ where }),
    ]);

    if (listings.length === 0) {
      return NextResponse.json({
        listings: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      });
    }

    // Get related data separately
    const cardIds = [...new Set(listings.map(l => l.card_id))];
    const userCardIds = listings.map(l => l.id);

    // Apply search filter to cards if needed
    let filteredListings = listings;
    if (search) {
      const matchingCards = await prisma.card.findMany({
        where: {
          id: { in: cardIds },
          name: { contains: search }
        },
        select: { id: true }
      });
      const matchingCardIds = new Set(matchingCards.map(c => c.id));
      filteredListings = listings.filter(l => matchingCardIds.has(l.card_id));
    }

    if (filteredListings.length === 0) {
      return NextResponse.json({
        listings: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      });
    }

    // Get related data
    const [cards, owner, allBids, allHistory] = await Promise.all([
      // Get cards
      prisma.card.findMany({
        where: { id: { in: cardIds } }
      }),
      // Get owner (just the admin user)
      prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, name: true, role: true }
      }),
      // Get bids for these user cards
      prisma.bid.findMany({
        where: {
          userCardId: { in: userCardIds },
          is_active: true
        },
        orderBy: { amount: 'desc' },
        take: userCardIds.length * 5 // Max 5 bids per listing
      }),
      // Get transaction history
      prisma.cardTransactionHistory.findMany({
        where: {
          userCardId: { in: userCardIds }
        },
        orderBy: { created_at: 'desc' },
        take: userCardIds.length // Latest history per listing
      })
    ]);

    // Get bidders for the bids
    const bidderIds = [...new Set(allBids.map(bid => bid.bidderId))];
    const bidders = bidderIds.length > 0 ? await prisma.user.findMany({
      where: { id: { in: bidderIds } },
      select: { id: true, name: true }
    }) : [];

    // Get history users (filter out nulls properly)
    const historyUserIds = [...new Set([
      ...allHistory.map(h => h.fromUserId).filter((id): id is number => id !== null),
      ...allHistory.map(h => h.toUserId).filter((id): id is number => id !== null)
    ])];
    const historyUsers = historyUserIds.length > 0 ? await prisma.user.findMany({
      where: { id: { in: historyUserIds } },
      select: { id: true, name: true }
    }) : [];

    // Create lookup maps
    const cardMap = new Map(cards.map(c => [c.id, c]));
    const bidderMap = new Map(bidders.map(b => [b.id, b]));
    const historyUserMap = new Map(historyUsers.map(u => [u.id, u]));

    // Group bids and history by user card ID
    const bidsByUserCard = new Map();
    const historyByUserCard = new Map();

    allBids.forEach(bid => {
      if (!bidsByUserCard.has(bid.userCardId)) {
        bidsByUserCard.set(bid.userCardId, []);
      }
      bidsByUserCard.get(bid.userCardId).push({
        ...bid,
        amount: Number(bid.amount),
        bidder: bidderMap.get(bid.bidderId)
      });
    });

    allHistory.forEach(history => {
      if (!historyByUserCard.has(history.userCardId)) {
        historyByUserCard.set(history.userCardId, []);
      }
      historyByUserCard.get(history.userCardId).push({
        ...history,
        fromUser: history.fromUserId ? historyUserMap.get(history.fromUserId) : null,
        toUser: history.toUserId ? historyUserMap.get(history.toUserId) : null
      });
    });

    // Build listings with stats
    const listingsWithStats = filteredListings.map((listing) => {
      const card = cardMap.get(listing.card_id);
      const bids = bidsByUserCard.get(listing.id) || [];
      const history = historyByUserCard.get(listing.id) || [];

      const currentHighestBid = bids[0];
      const timeLeft = listing.auction_end
        ? Math.max(0, listing.auction_end.getTime() - Date.now())
        : null;

      return {
        ...listing,
        card,
        owner,
        bids: bids.slice(0, 5), // Top 5 bids
        history: history.slice(0, 1), // Latest history
        current_highest_bid: currentHighestBid?.amount ?? null,
        bid_count: bids.length,
        time_left_ms: timeLeft,
        is_auction_active:
          listing.sale_type === 'AUCTION' &&
          (!listing.auction_end || listing.auction_end > new Date()),
        latest_activity: history[0] ?? null,
      };
    });

    return NextResponse.json({
      listings: listingsWithStats,
      pagination: {
        page,
        limit,
        total: filteredListings.length,
        totalPages: Math.ceil(filteredListings.length / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching admin listings:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch listings',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// POST /api/admin/listings - Create new marketplace listing
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if ("response" in auth) return auth.response;
    const user = auth.user;

    const body = (await request.json()) as CreateListingBody;
    const {
      card_id,
      condition,
      sale_type,
      fixed_price,
      reserve_price,
      auction_duration_hours,
      notes,
      quantity = 1,
    } = body;

    // Validate required fields
    if (!card_id || !condition || !sale_type) {
      return NextResponse.json(
        { error: 'Missing required fields: card_id, condition, sale_type' },
        { status: 400 },
      );
    }

    // Validate sale_type
    if (!['FIXED', 'AUCTION'].includes(sale_type)) {
      return NextResponse.json({ error: 'Invalid sale_type: must be FIXED or AUCTION' }, { status: 400 });
    }

    // Validate card_id
    const cardIdNum = parseInt(String(card_id), 10);
    if (isNaN(cardIdNum)) {
      return NextResponse.json({ error: 'Invalid card_id: must be a number' }, { status: 400 });
    }

    // Validate quantity
    const quantityNum = parseInt(String(quantity), 10);
    if (isNaN(quantityNum) || quantityNum < 1 || quantityNum > 100) {
      return NextResponse.json(
        { error: 'Invalid quantity: must be a number between 1 and 100' },
        { status: 400 },
      );
    }

    // Check if card exists
    const card = await prisma.card.findUnique({ where: { id: cardIdNum } });
    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Validate FIXED sale type
    if (sale_type === 'FIXED') {
      const fixedPriceNum = parseFloat(String(fixed_price));
      if (isNaN(fixedPriceNum) || fixedPriceNum <= 0) {
        return NextResponse.json(
          { error: 'Fixed price is required and must be greater than 0 for FIXED sale type' },
          { status: 400 },
        );
      }
    }

    // Validate AUCTION sale type
    let auctionDurationNum: number | undefined;
    if (sale_type === 'AUCTION') {
      auctionDurationNum = parseInt(String(auction_duration_hours), 10);
      if (isNaN(auctionDurationNum) || auctionDurationNum <= 0) {
        return NextResponse.json(
          { error: 'Auction duration is required and must be greater than 0 for AUCTION sale type' },
          { status: 400 },
        );
      }
      if (reserve_price !== undefined && reserve_price !== null) {
        const reservePriceNum = parseFloat(String(reserve_price));
        if (isNaN(reservePriceNum) || reservePriceNum <= 0) {
          return NextResponse.json(
            { error: 'Reserve price must be greater than 0 if provided' },
            { status: 400 },
          );
        }
      }
    }

    const createdListings = [];

    for (let i = 0; i < quantityNum; i++) {
      const listingData: ListingData = {
        card_id: cardIdNum,
        owner_id: user.id,
        condition,
        is_for_sale: true,
        sale_type,
        notes: notes || `Admin listing - ${condition} condition`,
      };

      if (sale_type === 'FIXED') {
        listingData.fixed_price = parseFloat(String(fixed_price));
      } else if (sale_type === 'AUCTION') {
        listingData.reserve_price = reserve_price ? parseFloat(String(reserve_price)) : null;
        if (auctionDurationNum) {
          const auctionEnd = new Date();
          auctionEnd.setHours(auctionEnd.getHours() + auctionDurationNum);
          listingData.auction_end = auctionEnd;
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        // Create user card without problematic include
        const userCard = await tx.userCard.create({
          data: listingData,
        });

        // Create transaction history
        await tx.cardTransactionHistory.create({
          data: {
            userCardId: userCard.id,
            toUserId: user.id,
            action: 'INITIAL',
            notes: `Admin created marketplace listing - ${sale_type} sale`,
          },
        });

        // Get related data separately for response
        const [cardData, ownerData] = await Promise.all([
          tx.card.findUnique({ where: { id: cardIdNum } }),
          tx.user.findUnique({
            where: { id: user.id },
            select: { id: true, name: true, role: true }
          })
        ]);

        return {
          ...userCard,
          card: cardData,
          owner: ownerData
        };
      });

      createdListings.push(result);
    }

    return NextResponse.json(
      {
        message: `Created ${quantityNum} listing(s) successfully`,
        listings: createdListings,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating listing:', error);
    return NextResponse.json(
      {
        error: 'Failed to create listing',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}