// src/app/api/user/collection/[id]/sell/route.ts - Updated with Commission System
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';
import { calculateCommission } from '../../../../../lib/commission-utils';

// POST /api/user/collection/[id]/sell - List a card for sale
export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        // Always use real session (ignore dev mode)
        const auth = await requireUser();
        if ("response" in auth) return auth.response;
        const user = auth.user;

        const userId = user.id;
        const userName = user.name || 'Unknown User';
        const userEmail = user.email || 'unknown';

        console.log(`🏷️ Sell API with Commission: ${userName} (${userEmail}) - ID: ${userId}`);

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

        // Get the card and verify ownership (without problematic includes)
        const userCard = await prisma.userCard.findUnique({
            where: { id: parseInt(userCardId) }
        });

        if (!userCard) {
            return NextResponse.json({ error: 'Card not found' }, { status: 404 });
        }

        // Get card details separately
        const card = await prisma.card.findUnique({
            where: { id: userCard.card_id },
            select: { name: true, id: true, rarity: true }
        });

        // Get owner details separately
        const owner = await prisma.user.findUnique({
            where: { id: userCard.owner_id },
            select: { id: true, name: true, email: true }
        });

        if (!card || !owner) {
            return NextResponse.json({ error: 'Card or owner not found' }, { status: 404 });
        }

        console.log('Card ownership check:', {
            userCardId: userCard.id,
            cardOwner: owner,
            currentUser: { id: userId, name: userName, email: userEmail },
            cardName: card.name,
            cardRarity: card.rarity
        });

        if (userCard.owner_id !== userId) {
            console.error('❌ Ownership mismatch:', {
                cardOwnerID: userCard.owner_id,
                cardOwnerName: owner.name,
                currentUserID: userId,
                currentUserName: userName,
                cardName: card.name
            });
            return NextResponse.json({
                error: `Access denied. This card belongs to ${owner.name} (ID: ${owner.id}), but you are ${userName} (ID: ${userId})`
            }, { status: 403 });
        }

        if (userCard.is_for_sale) {
            return NextResponse.json({ error: 'Card is already listed for sale' }, { status: 400 });
        }

        if (userCard.is_sold) {
            return NextResponse.json({ error: 'This card has already been sold' }, { status: 400 });
        }

        console.log('✅ Ownership verified! Calculating commission and updating card...');

        // Calculate commission for the card price to show user what they'll receive
        let commissionInfo = null;
        let sellerWillReceive = null;
        let buyerWillPay = null;

        if (sale_type === 'FIXED' && fixed_price) {
            const commission = await calculateCommission(Number(fixed_price), card.rarity);
            commissionInfo = {
                commission_rate: commission.commission_rate,
                commission_amount: commission.commission_amount,
                total_commission_collected: commission.commission_amount * 2, // Double commission for user-to-user
            };
            sellerWillReceive = commission.seller_receives;
            buyerWillPay = commission.buyer_pays;

            console.log('💰 Commission calculation for fixed price:', {
                cardPrice: fixed_price,
                rarity: card.rarity,
                commissionRate: commission.commission_rate,
                sellerReceives: sellerWillReceive,
                buyerPays: buyerWillPay,
                totalCommissionForPlatform: commissionInfo.total_commission_collected
            });
        }

        if (sale_type === 'AUCTION' && reserve_price !== undefined && reserve_price > 0) {
            const commission = await calculateCommission(Number(reserve_price), card.rarity);
            commissionInfo = {
                commission_rate: commission.commission_rate,
                commission_amount: commission.commission_amount,
                total_commission_collected: commission.commission_amount * 2, // Double commission for user-to-user
            };
            sellerWillReceive = commission.seller_receives;
            buyerWillPay = commission.buyer_pays;

            console.log('💰 Commission calculation for reserve price:', {
                reservePrice: reserve_price,
                rarity: card.rarity,
                commissionRate: commission.commission_rate,
                sellerReceives: sellerWillReceive,
                buyerPays: buyerWillPay,
                totalCommissionForPlatform: commissionInfo.total_commission_collected
            });
        }

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

        console.log('✅ Card listed successfully with commission info:', {
            id: updatedCard.id,
            cardName: card.name,
            saleType: sale_type,
            price: sale_type === 'FIXED' ? Number(fixed_price) : Number(reserve_price),
            owner: userName,
            commissionRate: commissionInfo?.commission_rate,
            sellerWillReceive,
            buyerWillPay
        });

        // Prepare response with commission information
        const responseData: any = {
            success: true,
            message: `${card.name} listed for ${sale_type.toLowerCase()} sale`,
            listing: {
                id: parseInt(userCardId),
                card_name: card.name,
                card_rarity: card.rarity,
                sale_type: sale_type,
                price: sale_type === 'FIXED' ? Number(fixed_price) : Number(reserve_price),
                auction_end: updateData.auction_end,
                owner: userName
            }
        };

        // Add commission info if calculated
        if (commissionInfo) {
            responseData.commission_info = {
                commission_rate: commissionInfo.commission_rate.toFixed(2) + '%',
                commission_per_side: commissionInfo.commission_amount.toFixed(2),
                total_platform_commission: commissionInfo.total_commission_collected.toFixed(2),
                seller_will_receive: sellerWillReceive?.toFixed(2),
                buyer_will_pay: buyerWillPay?.toFixed(2),
                explanation: `Commission is ${commissionInfo.commission_rate.toFixed(2)}% collected from both buyer and seller. You will receive $${sellerWillReceive?.toFixed(2)} after commission.`
            };
        }

        return NextResponse.json(responseData);

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
        const auth = await requireUser();
        if ("response" in auth) return auth.response;
        const user = auth.user;

        const userId = user.id;
        const userName = user.name || 'Unknown User';

        const { id: userCardId } = await context.params;

        console.log(`🗑️ Remove from sale: ${userName} removing card ${userCardId}`);

        // Get the card (without problematic includes)
        const userCard = await prisma.userCard.findUnique({
            where: { id: parseInt(userCardId) }
        });

        if (!userCard) {
            return NextResponse.json({ error: 'Card not found' }, { status: 404 });
        }

        // Get card details separately
        const card = await prisma.card.findUnique({
            where: { id: userCard.card_id },
            select: { name: true }
        });

        if (!card) {
            return NextResponse.json({ error: 'Card details not found' }, { status: 404 });
        }

        // Verify ownership
        if (userCard.owner_id !== userId) {
            console.error('❌ Ownership mismatch on remove from sale:', {
                cardOwnerID: userCard.owner_id,
                currentUserID: userId,
                cardName: card.name
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
            card_name: card.name
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