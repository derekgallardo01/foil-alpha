import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
import { Prisma } from '@prisma/client';

// GET /api/marketplace - Get cards for sale
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const saleType = searchParams.get('sale_type') || '';
    const condition = searchParams.get('condition') || '';

    const skip = (page - 1) * limit;

    // Define the where clause with proper Prisma typing
    const where: Prisma.UserCardWhereInput = {
      is_for_sale: true,
      is_sold: false,
    };

    if (saleType) {
      where.sale_type = saleType;
    }

    if (condition) {
      where.condition = condition;
    }

    // Active auctions only
    if (saleType === 'AUCTION') {
      where.auction_end = {
        gt: new Date(),
      };
    }

    // Get user cards that are for sale
    const [userCards, totalCount] = await Promise.all([
      prisma.userCard.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          created_at: 'desc' as Prisma.SortOrder,
        },
      }),
      prisma.userCard.count({ where }),
    ]);

    // Build listings array step by step
    const listings = [];

    for (const userCard of userCards) {
      try {
        // Get card details
        const card = await prisma.card.findUnique({
          where: { id: userCard.card_id },
        });

        if (!card) continue;

        // Apply search filter
        if (search && !card.name.toLowerCase().includes(search.toLowerCase())) {
          continue;
        }

        // Get owner details
        const owner = await prisma.user.findUnique({
          where: { id: userCard.owner_id },
        });

        if (!owner) continue;

        // Get bid count for auctions
        const bidCount =
          userCard.sale_type === 'AUCTION'
            ? await prisma.bid.count({
                where: {
                  userCardId: userCard.id, // Fixed: user_card_id → userCardId
                  is_active: true,
                },
              })
            : 0;

        // Get highest bid amount for auctions
        let highestBid: number | null = null;
        if (userCard.sale_type === 'AUCTION') {
          const topBid = await prisma.bid.findFirst({
            where: {
              userCardId: userCard.id, // Fixed: user_card_id → userCardId
              is_active: true,
            },
            orderBy: { amount: 'desc' },
          });
          highestBid = topBid ? Number(topBid.amount) : null;
        }

        // Calculate current price
        const current_price =
          userCard.sale_type === 'FIXED'
            ? Number(userCard.fixed_price || 0)
            : highestBid || Number(userCard.reserve_price || 0);

        // Calculate time remaining for auctions
        const time_remaining =
          userCard.sale_type === 'AUCTION' && userCard.auction_end
            ? Math.max(0, new Date(userCard.auction_end).getTime() - Date.now())
            : null;

        // Build listing object
        const listing = {
          id: userCard.id,
          card: {
            id: card.id,
            name: card.name,
            set_name: card.set_name,
            set_number: card.set_number,
            rarity: card.rarity,
            card_type: card.card_type,
            image_url: card.image_url,
            small_image_url: card.small_image_url,
          },
          owner: {
            id: owner.id,
            name: owner.name,
          },
          condition: userCard.condition,
          sale_type: userCard.sale_type,
          fixed_price: userCard.fixed_price ? Number(userCard.fixed_price) : null,
          reserve_price: userCard.reserve_price ? Number(userCard.reserve_price) : null,
          auction_end: userCard.auction_end,
          current_price,
          highest_bid: highestBid,
          bid_count: bidCount,
          time_remaining,
          notes: userCard.notes,
        };

        listings.push(listing);
      } catch (error) {
        console.error('Error processing listing:', error);
        // Continue with next listing if one fails
        continue;
      }
    }

    return NextResponse.json({
      listings,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching marketplace:', error);
    return NextResponse.json(
      { error: 'Failed to fetch marketplace listings' },
      { status: 500 },
    );
  }
}