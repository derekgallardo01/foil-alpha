// src/app/api/user/collection/[id]/sell/route.ts - Fixed to use real session
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../auth/[...nextauth]/route';
import { prisma } from '../../../../../lib/prisma';

// POST /api/user/collection/[id]/sell - List a card for sale
export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        // Always use real session (ignore dev mode)
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Authentication required. Please log in.' }, { status: 401 });
        }

        const userId = parseInt(session.user.id);
        const userName = session.user.name || 'Unknown User';
        const userEmail = session.user.email || 'unknown';

        console.log(`🏷️ Sell API: ${userName} (${userEmail}) - ID: ${userId}`);

        const { id: userCardId } = await context.params;
        const body = await request.json();
        const { sale_type, fixed_price, reserve_price, auction_duration_hours } = body;

        console.log('Sell request:', {
            sale_type,
            fixed_price,
            reserve_price,
            auction_duration_hours,
            userCardId,
            userId,
            userName
        });

        // Validate sale type
        if (!['FIXED', 'AUCTION'].includes(sale_type)) {
            return NextResponse.json({ error: 'sale_type must be FIXED or AUCTION' }, { status: 400 });
        }

        // Validate required fields based on sale type
        if (sale_type === 'FIXED') {
            if (!fixed_price || fixed_price <= 0) {
                return NextResponse.json({ error: 'fixed_price is required for fixed price sales' }, { status: 400 });
            }
        }

        if (sale_type === 'AUCTION') {
            if (reserve_price === undefined || reserve_price < 0) {
                return NextResponse.json({ error: 'reserve_price is required for auctions' }, { status: 400 });
            }
            if (!auction_duration_hours || auction_duration_hours < 1 || auction_duration_hours > 168) {
                return NextResponse.json({
                    error: `auction_duration_hours must be between 1 and 168 hours. Received: ${auction_duration_hours}`
                }, { status: 400 });
            }
        }

        // Get the card and verify ownership
        const userCard = await prisma.userCard.findUnique({
            where: { id: parseInt(userCardId) },
            include: {
                card: {
                    select: { name: true, id: true }
                },
                owner: {
                    select: { id: true, name: true, email: true }
                }
            }
        });

        console.log('Card ownership check:', {
            userCardId: userCard?.id,
            cardOwner: userCard?.owner,
            currentUser: { id: userId, name: userName, email: userEmail },
            cardName: userCard?.card?.name
        });

        if (!userCard) {
            return NextResponse.json({ error: 'Card not found' }, { status: 404 });
        }

        if (userCard.owner_id !== userId) {
            console.error('❌ Ownership mismatch:', {
                cardOwnerID: userCard.owner_id,
                cardOwnerName: userCard.owner.name,
                currentUserID: userId,
                currentUserName: userName,
                cardName: userCard.card.name
            });
            return NextResponse.json({
                error: `Access denied. This card belongs to ${userCard.owner.name} (ID: ${userCard.owner_id}), but you are ${userName} (ID: ${userId})`
            }, { status: 403 });
        }

        if (userCard.is_for_sale) {
            return NextResponse.json({ error: 'Card is already listed for sale' }, { status: 400 });
        }

        if (userCard.is_sold) {
            return NextResponse.json({ error: 'This card has already been sold' }, { status: 400 });
        }

        console.log('✅ Ownership verified! Updating card...');

        // Prepare update data
        const updateData: any = {
            is_for_sale: true,
            sale_type,
        };

        if (sale_type === 'FIXED') {
            updateData.fixed_price = Number(fixed_price);
            updateData.reserve_price = null;
            updateData.auction_end = null;
        } else if (sale_type === 'AUCTION') {
            updateData.fixed_price = null;
            updateData.reserve_price = Number(reserve_price);
            // Calculate auction end time from duration
            updateData.auction_end = new Date(Date.now() + Number(auction_duration_hours) * 60 * 60 * 1000);
        }

        console.log('Update data:', updateData);

        // Update the card
        const updatedCard = await prisma.userCard.update({
            where: { id: parseInt(userCardId) },
            data: updateData
        });

        console.log('✅ Card listed successfully:', {
            id: updatedCard.id,
            cardName: userCard.card.name,
            saleType: sale_type,
            price: sale_type === 'FIXED' ? Number(fixed_price) : Number(reserve_price),
            owner: userName
        });

        return NextResponse.json({
            success: true,
            message: `${userCard.card.name} listed for ${sale_type.toLowerCase()} sale`,
            listing: {
                id: parseInt(userCardId),
                card_name: userCard.card.name,
                sale_type: sale_type,
                price: sale_type === 'FIXED' ? Number(fixed_price) : Number(reserve_price),
                auction_end: updateData.auction_end,
                owner: userName
            }
        });

    } catch (error) {
        console.error('❌ Error listing card for sale:', error);
        return NextResponse.json(
            {
                error: 'Failed to list card for sale',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

// DELETE /api/user/collection/[id]/sell - Remove card from sale
export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        // Always use real session (ignore dev mode)
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Authentication required. Please log in.' }, { status: 401 });
        }

        const userId = parseInt(session.user.id);
        const userName = session.user.name || 'Unknown User';

        const { id: userCardId } = await context.params;

        console.log(`🗑️ Remove from sale: ${userName} removing card ${userCardId}`);

        // Get the card
        const userCard = await prisma.userCard.findUnique({
            where: { id: parseInt(userCardId) },
            include: {
                card: {
                    select: { name: true }
                }
            }
        });

        if (!userCard) {
            return NextResponse.json({ error: 'Card not found' }, { status: 404 });
        }

        // Verify ownership
        if (userCard.owner_id !== userId) {
            console.error('❌ Ownership mismatch on remove from sale:', {
                cardOwnerID: userCard.owner_id,
                currentUserID: userId,
                cardName: userCard.card.name
            });
            return NextResponse.json({
                error: 'You can only manage your own cards'
            }, { status: 403 });
        }

        // Check if not for sale
        if (!userCard.is_for_sale) {
            return NextResponse.json({ error: 'Card is not currently for sale' }, { status: 400 });
        }

        // Check if has active bids (for auctions)
        if (userCard.sale_type === 'AUCTION') {
            const activeBids = await prisma.bid.count({
                where: {
                    userCardId: parseInt(userCardId),
                    is_active: true
                }
            });

            if (activeBids > 0) {
                return NextResponse.json({
                    error: 'Cannot remove auction with active bids'
                }, { status: 400 });
            }
        }

        // Remove from sale
        await prisma.userCard.update({
            where: { id: parseInt(userCardId) },
            data: {
                is_for_sale: false,
                sale_type: null,
                fixed_price: null,
                reserve_price: null,
                auction_end: null
            }
        });

        console.log('✅ Card removed from sale successfully');

        return NextResponse.json({
            success: true,
            message: 'Card removed from sale',
            card_name: userCard.card.name
        });

    } catch (error) {
        console.error('❌ Error removing card from sale:', error);
        return NextResponse.json(
            {
                error: 'Failed to remove card from sale',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}