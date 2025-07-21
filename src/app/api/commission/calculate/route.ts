// src/app/api/commission/calculate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { calculateCommission } from '../../../lib/commission-utils';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { card_price, card_rarity, transaction_type } = body;

        // Validate input
        if (typeof card_price !== 'number' || card_price <= 0) {
            return NextResponse.json(
                { error: 'Valid card price is required' },
                { status: 400 }
            );
        }

        if (!card_rarity || typeof card_rarity !== 'string') {
            return NextResponse.json(
                { error: 'Card rarity is required' },
                { status: 400 }
            );
        }

        // Calculate commission
        const commission = await calculateCommission(card_price, card_rarity);

        // Adjust for transaction type
        let result = {
            commission_rate: commission.commission_rate,
            commission_amount: commission.commission_amount,
            buyer_pays: commission.buyer_pays,
            seller_receives: commission.seller_receives,
            admin_receives: commission.admin_receives
        };

        // For user-to-user sales, admin gets double commission (from both sides)
        if (transaction_type === 'USER_SALE') {
            result.admin_receives = commission.commission_amount * 2;
        }

        return NextResponse.json(result);

    } catch (error) {
        console.error('Error calculating commission:', error);
        return NextResponse.json(
            { error: 'Failed to calculate commission' },
            { status: 500 }
        );
    }
}