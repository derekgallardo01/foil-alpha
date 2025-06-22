import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '../../../lib/prisma';

// GET /api/user/collection - Get user's card collection
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);

    const userCards = await prisma.userCard.findMany({
      where: {
        owner_id: userId,
        // ✅ Remove is_sold filter - show ALL owned cards
      },
      orderBy: {
        acquired_date: 'desc',
      },
    });

    // Enrich with card details step by step
    const enrichedCollection = [];

    for (const userCard of userCards) {
      try {
        // Get card details
        const card = await prisma.card.findUnique({
          where: { id: userCard.card_id },
          select: {
            id: true,
            name: true,
            set_name: true,
            set_number: true,
            rarity: true,
            card_type: true,
            image_url: true,
            small_image_url: true,
          },
        });

        if (!card) continue;

        // Get bid count if it's an auction
        const bidCount =
          userCard.sale_type === 'AUCTION'
            ? await prisma.bid.count({
                where: {
                  userCardId: userCard.id, // Fixed: user_card_id → userCardId
                  is_active: true,
                },
              })
            : 0;

        enrichedCollection.push({
          id: userCard.id,
          card,
          condition: userCard.condition,
          is_for_sale: userCard.is_for_sale,
          sale_type: userCard.sale_type,
          fixed_price: userCard.fixed_price ? Number(userCard.fixed_price) : null,
          reserve_price: userCard.reserve_price ? Number(userCard.reserve_price) : null,
          auction_end: userCard.auction_end,
          is_sold: userCard.is_sold,
          notes: userCard.notes,
          acquired_date: userCard.acquired_date,
          bid_count: bidCount,
        });
      } catch (error) {
        console.error('Error processing user card:', error);
        continue;
      }
    }

    return NextResponse.json(enrichedCollection);
  } catch (error) {
    console.error('Error fetching user collection:', error);
    return NextResponse.json({ error: 'Failed to fetch collection' }, { status: 500 });
  }
}