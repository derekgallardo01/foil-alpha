// src/app/api/user/collection/route.ts - Updated with NextAuth integration
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '../../../lib/prisma';
import { getCurrentDevUserForAPI, isDevMode } from '../../../lib/dev-auth';

// GET /api/user/collection - Get user's card collection
export async function GET(request: NextRequest) {
  try {
    // Get user session with dev mode support
    let userId: number;
    let userEmail: string;

    if (isDevMode()) {
      const devUser = getCurrentDevUserForAPI();
      if (!devUser) {
        return NextResponse.json({ error: 'Dev mode: No dev user configured' }, { status: 401 });
      }
      userId = devUser.id;
      userEmail = devUser.email;
      console.log(`🚧 DEV MODE: Fetching collection for ${userEmail} (ID: ${userId})`);
    } else {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      userId = parseInt(session.user.id);
      userEmail = session.user.email || 'unknown';
    }

    console.log(`Fetching collection for user ID: ${userId}`);

    const userCards = await prisma.userCard.findMany({
      where: {
        owner_id: userId,
        // Show ALL owned cards including sold ones (user owns the history)
      },
      include: {
        card: {
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
        },
        _count: {
          select: {
            bids: {
              where: { is_active: true }
            }
          }
        }
      },
      orderBy: {
        acquired_date: 'desc',
      },
    });

    console.log(`Found ${userCards.length} cards for user ${userId}`);

    // Transform the data to match expected format
    const enrichedCollection = userCards.map(userCard => ({
      id: userCard.id,
      card: userCard.card,
      condition: userCard.condition,
      is_for_sale: userCard.is_for_sale,
      sale_type: userCard.sale_type,
      fixed_price: userCard.fixed_price ? Number(userCard.fixed_price) : null,
      reserve_price: userCard.reserve_price ? Number(userCard.reserve_price) : null,
      auction_end: userCard.auction_end,
      is_sold: userCard.is_sold,
      notes: userCard.notes,
      acquired_date: userCard.acquired_date || userCard.created_at,
      bid_count: userCard._count.bids,
    }));

    console.log(`Returning ${enrichedCollection.length} cards in collection`);

    return NextResponse.json(enrichedCollection);
  } catch (error) {
    console.error('Error fetching user collection:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collection', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}