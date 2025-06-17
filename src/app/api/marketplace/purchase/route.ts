// src/app/api/marketplace/purchase/route.ts - Fixed ownership transfer
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '../../../lib/prisma';

// POST /api/marketplace/purchase - Purchase a card
export async function POST(request: NextRequest) {
    try {
        console.log('🛒 Purchase API called');

        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            console.log('❌ No session found');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const buyerId = parseInt(session.user.id);
        console.log('👤 Buyer ID:', buyerId);

        const body = await request.json();
        console.log('📦 Request body:', body);

        const { user_card_id } = body;

        if (!user_card_id) {
            console.log('❌ No user_card_id provided');
            return NextResponse.json({ error: 'user_card_id is required' }, { status: 400 });
        }

        console.log('🎴 Looking for user card:', user_card_id);

        // Get the card being purchased
        const userCard = await prisma.userCard.findUnique({
            where: { id: parseInt(user_card_id) }
        });

        if (!userCard) {
            console.log('❌ User card not found:', user_card_id);
            return NextResponse.json({ error: 'Card not found' }, { status: 404 });
        }

        console.log('🎴 Found user card:', {
            id: userCard.id,
            owner_id: userCard.owner_id,
            is_for_sale: userCard.is_for_sale,
            sale_type: userCard.sale_type,
            fixed_price: userCard.fixed_price,
            is_sold: userCard.is_sold
        });

        // Get card details separately
        const card = await prisma.card.findUnique({
            where: { id: userCard.card_id }
        });

        // Get owner details separately
        const owner = await prisma.user.findUnique({
            where: { id: userCard.owner_id },
            select: { id: true, name: true, email: true }
        });

        if (!card || !owner) {
            console.log('❌ Card or owner not found');
            return NextResponse.json({ error: 'Card or owner not found' }, { status: 404 });
        }

        console.log('📝 Card details:', card.name, 'Owner:', owner.name);

        // Validation checks
        if (!userCard.is_for_sale || userCard.is_sold) {
            console.log('❌ Card not for sale or already sold');
            return NextResponse.json({ error: 'Card is not for sale' }, { status: 400 });
        }

        if (userCard.owner_id === buyerId) {
            console.log('❌ Buyer trying to buy own card');
            return NextResponse.json({ error: 'Cannot buy your own card' }, { status: 400 });
        }

        // Only handle fixed price purchases for now
        if (userCard.sale_type !== 'FIXED' || !userCard.fixed_price) {
            console.log('❌ Not a fixed price sale');
            return NextResponse.json({ error: 'Only fixed price purchases supported' }, { status: 400 });
        }

        const purchasePrice = userCard.fixed_price;
        console.log('💰 Purchase price:', Number(purchasePrice));

        // Get buyer's wallet
        const buyerWallet = await prisma.userWallet.findUnique({
            where: { user_id: buyerId }
        });

        if (!buyerWallet) {
            console.log('❌ Buyer wallet not found');
            return NextResponse.json({ error: 'Wallet not found' }, { status: 400 });
        }

        console.log('💳 Buyer wallet:', {
            balance: Number(buyerWallet.balance),
            frozen: Number(buyerWallet.frozen_balance),
            available: Number(buyerWallet.balance) - Number(buyerWallet.frozen_balance)
        });

        const availableBalance = Number(buyerWallet.balance) - Number(buyerWallet.frozen_balance);

        if (availableBalance < Number(purchasePrice)) {
            console.log('❌ Insufficient balance:', {
                required: Number(purchasePrice),
                available: availableBalance
            });
            return NextResponse.json({
                error: 'Insufficient balance',
                details: {
                    required: Number(purchasePrice),
                    available: availableBalance,
                    total_balance: Number(buyerWallet.balance),
                    frozen_balance: Number(buyerWallet.frozen_balance)
                }
            }, { status: 400 });
        }

        // Get or create seller's wallet
        let sellerWallet = await prisma.userWallet.findUnique({
            where: { user_id: userCard.owner_id }
        });

        if (!sellerWallet) {
            console.log('🏦 Creating seller wallet');
            sellerWallet = await prisma.userWallet.create({
                data: {
                    user_id: userCard.owner_id,
                    balance: 0.00,
                    frozen_balance: 0.00
                }
            });
        }

        console.log('💰 Starting transaction processing...');

        // Execute the purchase transaction
        const result = await prisma.$transaction(async (tx) => {
            // 1. Update buyer's wallet
            const newBuyerBalance = Number(buyerWallet.balance) - Number(purchasePrice);
            await tx.userWallet.update({
                where: { user_id: buyerId },
                data: { balance: newBuyerBalance }
            });

            // 2. Update seller's wallet
            const newSellerBalance = Number(sellerWallet!.balance) + Number(purchasePrice);
            await tx.userWallet.update({
                where: { user_id: userCard.owner_id },
                data: { balance: newSellerBalance }
            });

            // 3. Transfer card ownership - FIXED VERSION
            await tx.userCard.update({
                where: { id: parseInt(user_card_id) },
                data: {
                    owner_id: buyerId,
                    is_for_sale: false,
                    is_sold: false,        // ✅ NOT sold, just transferred
                    sale_type: null,
                    fixed_price: null,
                    auction_end: null,
                    acquired_date: new Date() // ✅ Update acquisition date
                }
            });

            // 4. Create transaction record
            const transaction = await tx.transaction.create({
                data: {
                    user_card_id: parseInt(user_card_id),
                    buyer_id: buyerId,
                    seller_id: userCard.owner_id,
                    amount: purchasePrice,
                    transaction_type: 'FIXED_PRICE',
                    status: 'COMPLETED',
                    completed_at: new Date()
                }
            });

            // 5. Create wallet transaction records
            await tx.walletTransaction.createMany({
                data: [
                    // Buyer's transaction
                    {
                        user_id: buyerId,
                        transaction_type: 'PURCHASE',
                        amount: -Number(purchasePrice),
                        balance_before: Number(buyerWallet.balance),
                        balance_after: newBuyerBalance,
                        description: `Purchased ${card.name}`,
                        reference_id: transaction.id,
                        reference_type: 'TRANSACTION'
                    },
                    // Seller's transaction
                    {
                        user_id: userCard.owner_id,
                        transaction_type: 'SALE',
                        amount: Number(purchasePrice),
                        balance_before: Number(sellerWallet!.balance),
                        balance_after: newSellerBalance,
                        description: `Sold ${card.name}`,
                        reference_id: transaction.id,
                        reference_type: 'TRANSACTION'
                    }
                ]
            });

            // 6. Create card history record
            await tx.cardHistory.create({
                data: {
                    user_card_id: parseInt(user_card_id),
                    from_user_id: userCard.owner_id,
                    to_user_id: buyerId,
                    transaction_type: 'PURCHASE',
                    price: purchasePrice,
                    notes: `Purchased for $${purchasePrice} from ${owner.name}`
                }
            });

            return {
                transaction,
                buyer_new_balance: newBuyerBalance,
                seller_new_balance: newSellerBalance
            };
        });

        console.log('✅ Purchase completed successfully');

        return NextResponse.json({
            success: true,
            transaction_id: result.transaction.id,
            card_name: card.name,
            purchase_price: Number(purchasePrice),
            new_balance: result.buyer_new_balance,
            seller: owner.name
        });

    } catch (error) {
        console.error('❌ Error purchasing card:', error);
        return NextResponse.json(
            {
                error: 'Failed to purchase card',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}