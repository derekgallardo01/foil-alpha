// src/app/api/marketplace/purchase/route.ts - Fixed TypeScript Errors
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '../../../lib/prisma';
import { calculateCommission, recordCommissionTransaction } from '../../../lib/commission-utils';

export async function POST(request: NextRequest) {
  try {
    // Get real session (Next.js 15 compatible)
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in.' },
        { status: 401 }
      );
    }

    const userId = parseInt(session.user.id);
    const userName = session.user.name || 'Unknown User';

    console.log(`Purchase by user: ${userName} (ID: ${userId})`);

    // Parse request body
    let body;
    try {
      const rawBody = await request.text();
      if (!rawBody || rawBody.trim() === '') {
        return NextResponse.json(
          { error: 'Request body is empty' },
          { status: 400 }
        );
      }
      body = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { user_card_id, catalog_card_id, quantity = 1 } = body;

    console.log('Purchase request:', {
      userId,
      userName,
      user_card_id,
      catalog_card_id,
      quantity,
    });

    // Validate request
    if (!user_card_id && !catalog_card_id) {
      return NextResponse.json(
        { error: 'Either user_card_id or catalog_card_id must be provided' },
        { status: 400 }
      );
    }

    // Handle different purchase types
    if (user_card_id) {
      return await purchaseUserCard(userId, user_card_id);
    } else if (catalog_card_id) {
      return await purchaseCatalogCard(userId, catalog_card_id, quantity);
    }

  } catch (error) {
    console.error('Purchase error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process purchase',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Purchase user-owned card with commission system and proper transfer
async function purchaseUserCard(buyerId: number, userCardId: number) {
  return await prisma.$transaction(async (tx) => {
    console.log(`🔍 DEBUG: Starting user card purchase with proper transfer`);
    console.log(`👤 Buyer ID: ${buyerId}`);
    console.log(`🎴 User Card ID: ${userCardId}`);

    // Get user card and verify it's still available
    const userCard = await tx.userCard.findUnique({
      where: {
        id: userCardId,
        is_for_sale: true,
        is_sold: false
      }
    });

    if (!userCard) {
      throw new Error('Card not found or no longer available for sale');
    }

    // Verify buyer is not the owner
    if (userCard.owner_id === buyerId) {
      throw new Error('You cannot purchase your own card');
    }

    // Verify it's not expired if it's an auction
    if (userCard.sale_type === 'AUCTION' && userCard.auction_end) {
      if (new Date(userCard.auction_end) <= new Date()) {
        throw new Error('This auction has expired');
      }
    }

    // Get related data
    const [card, owner] = await Promise.all([
      tx.card.findUnique({ where: { id: userCard.card_id } }),
      tx.user.findUnique({ where: { id: userCard.owner_id } })
    ]);

    if (!card || !owner) {
      throw new Error('Card or owner not found');
    }

    const cardPrice = Number(userCard.fixed_price || 0);
    console.log(`💰 Card price: $${cardPrice}`);

    // Calculate commission based on card rarity
    const commission = await calculateCommission(cardPrice, card.rarity);
    console.log(`📊 Commission calculation:`, commission);

    // For user-to-user sales: Commission is collected from both buyer and seller
    // Buyer pays: cardPrice + commission
    // Seller receives: cardPrice - commission  
    // Admin gets: commission * 2 (from both sides)
    const totalCommissionForAdmin = commission.commission_amount * 2;

    console.log(`📊 Transaction breakdown:`, {
      cardPrice,
      commissionRate: commission.commission_rate,
      commissionAmount: commission.commission_amount,
      buyerPays: commission.buyer_pays, // cardPrice + commission
      sellerReceives: commission.seller_receives, // cardPrice - commission
      adminReceives: totalCommissionForAdmin // commission from both sides
    });

    // Get buyer's wallet BEFORE transaction
    let buyerWallet = await tx.userWallet.findUnique({
      where: { user_id: buyerId }
    });

    if (!buyerWallet) {
      buyerWallet = await tx.userWallet.create({
        data: {
          user_id: buyerId,
          balance: 1000, // Give new users $1000 to start
          frozen_balance: 0
        }
      });
      console.log(`✅ Created new wallet for user ${buyerId} with $1000`);
    }

    const buyerBalance = Number(buyerWallet.balance);

    console.log(`💵 Balance check:`, {
      buyerBalance,
      totalCost: commission.buyer_pays,
      sufficient: buyerBalance >= commission.buyer_pays
    });

    if (buyerBalance < commission.buyer_pays) {
      throw new Error(`Insufficient funds. Required: $${commission.buyer_pays.toFixed(2)}, Available: $${buyerBalance.toFixed(2)}`);
    }

    // Get seller's wallet
    let sellerWallet = await tx.userWallet.findUnique({
      where: { user_id: userCard.owner_id }
    });

    if (!sellerWallet) {
      sellerWallet = await tx.userWallet.create({
        data: {
          user_id: userCard.owner_id,
          balance: 0,
          frozen_balance: 0
        }
      });
    }

    const sellerBalanceBefore = Number(sellerWallet.balance);

    // Update wallets
    const [updatedBuyerWallet, updatedSellerWallet] = await Promise.all([
      tx.userWallet.update({
        where: { user_id: buyerId },
        data: { balance: { decrement: commission.buyer_pays } }
      }),
      tx.userWallet.update({
        where: { user_id: userCard.owner_id },
        data: { balance: { increment: commission.seller_receives } }
      })
    ]);

    // Record commission in admin wallet (double commission for user-to-user sales)
    await recordCommissionTransaction({
      transaction_type: 'COMMISSION',
      amount: totalCommissionForAdmin,
      description: `Commission from ${card.name} user-to-user sale (${commission.commission_rate}% from both buyer and seller)`,
      reference_type: 'USER_CARD',
      reference_id: userCardId,
      user_card_id: userCardId,
      buyer_id: buyerId,
      seller_id: userCard.owner_id,
      card_id: card.id,
      commission_rate: commission.commission_rate
    }, tx);

    console.log(`🔍 BEFORE UPDATE - Card ${userCardId} status:`, {
      is_for_sale: userCard.is_for_sale,
      is_sold: userCard.is_sold,
      owner_id: userCard.owner_id
    });

    // Replace the update with this:
    const updatedCard = await tx.userCard.update({
      where: { id: userCardId },
      data: {
        owner_id: buyerId,
        is_for_sale: false,
        is_sold: true,
        sale_type: null,
        fixed_price: null,
        auction_end: null,
        notes: `Purchased from ${owner.name} for $${cardPrice.toFixed(2)} (${commission.commission_rate}% commission) - Transferred ${new Date().toLocaleDateString()}`
      }
    });

    // Right AFTER the update
    console.log(`🔍 AFTER UPDATE - Card ${userCardId} status:`, {
      is_for_sale: updatedCard.is_for_sale,
      is_sold: updatedCard.is_sold,
      owner_id: updatedCard.owner_id
    });

    // Verify the update with a fresh query
    const verifyUpdate = await tx.userCard.findUnique({
      where: { id: userCardId },
      select: {
        id: true,
        is_for_sale: true,
        is_sold: true,
        owner_id: true
      }
    });

    console.log(`🔍 VERIFY UPDATE - Fresh query for card ${userCardId}:`, verifyUpdate);

    // Record wallet transactions
    await Promise.all([
      tx.walletTransaction.create({
        data: {
          user_id: buyerId,
          wallet_id: buyerWallet.id,
          transaction_type: 'PURCHASE',
          amount: -commission.buyer_pays,
          balance_before: buyerBalance,
          balance_after: buyerBalance - commission.buyer_pays,
          description: `Purchased ${card.name} from ${owner.name} (includes ${commission.commission_rate}% commission)`,
          reference_type: 'USER_CARD',
          reference_id: userCardId
        }
      }),
      tx.walletTransaction.create({
        data: {
          user_id: userCard.owner_id,
          wallet_id: sellerWallet.id,
          transaction_type: 'SALE',
          amount: commission.seller_receives,
          balance_before: sellerBalanceBefore,
          balance_after: sellerBalanceBefore + commission.seller_receives,
          description: `Sold ${card.name} (after ${commission.commission_rate}% commission)`,
          reference_type: 'USER_CARD',
          reference_id: userCardId
        }
      })
    ]);

    // Record the ownership transfer in transaction history
    await tx.cardTransactionHistory.create({
      data: {
        userCardId: userCardId,
        fromUserId: userCard.owner_id,
        toUserId: buyerId,
        action: 'SALE',
        notes: `Card sold for $${cardPrice.toFixed(2)} with ${commission.commission_rate}% commission. Seller received $${commission.seller_receives.toFixed(2)}, buyer paid $${commission.buyer_pays.toFixed(2)}`
      }
    });

    console.log(`✅ User card purchase completed successfully - ownership transferred`);

    return NextResponse.json({
      success: true,
      message: 'Card purchased and transferred successfully!',
      purchase_details: {
        card_name: card.name,
        card_price: cardPrice.toFixed(2),
        commission_rate: commission.commission_rate.toFixed(2),
        commission_amount: commission.commission_amount.toFixed(2),
        total_paid: commission.buyer_pays.toFixed(2),
        seller_receives: commission.seller_receives.toFixed(2),
        seller_name: owner.name,
        transaction_id: userCardId,
        buyer_new_balance: (buyerBalance - commission.buyer_pays).toFixed(2),
        ownership_transferred: true
      }
    });
  });
}

// Purchase catalog card with commission system and proper inventory
async function purchaseCatalogCard(buyerId: number, catalogCardId: number, quantity: number) {
  return await prisma.$transaction(async (tx) => {
    console.log(`Processing catalog purchase with commission: Buyer ${buyerId}, Card ${catalogCardId}, Qty ${quantity}`);

    const catalogCard = await tx.card.findUnique({
      where: { id: catalogCardId }
    });

    if (!catalogCard) {
      throw new Error('Card not found');
    }

    if (!catalogCard.market_price || Number(catalogCard.market_price) <= 0) {
      throw new Error('Card price not set');
    }

    const unitPrice = Number(catalogCard.market_price);

    // Calculate commission for marketplace purchase
    const commission = await calculateCommission(unitPrice, catalogCard.rarity);
    const totalCostPerCard = commission.buyer_pays;
    const totalCost = totalCostPerCard * quantity;
    const totalCommission = commission.admin_receives * quantity;

    console.log(`Card: ${catalogCard.name}, Unit Price: $${unitPrice}, Commission: ${commission.commission_rate}%, Total Cost: $${totalCost}`);

    // Get or create buyer's wallet
    let buyerWallet = await tx.userWallet.findUnique({
      where: { user_id: buyerId }
    });

    if (!buyerWallet) {
      buyerWallet = await tx.userWallet.create({
        data: {
          user_id: buyerId,
          balance: 1000, // Give new users $1000 to start
          frozen_balance: 0
        }
      });
      console.log(`Created new wallet for user ${buyerId} with $1000`);
    }

    const buyerBalance = Number(buyerWallet.balance);
    console.log(`Buyer balance: $${buyerBalance}, Required: $${totalCost}`);

    if (buyerBalance < totalCost) {
      throw new Error(`Insufficient funds. Required: $${totalCost.toFixed(2)}, Available: $${buyerBalance.toFixed(2)}`);
    }

    // Update wallet
    await tx.userWallet.update({
      where: { user_id: buyerId },
      data: { balance: { decrement: totalCost } }
    });

    // Record both marketplace sale and commission in admin wallet
    await Promise.all([
      recordCommissionTransaction({
        transaction_type: 'MARKETPLACE_SALE',
        amount: unitPrice * quantity, // The card price goes to admin (marketplace sale)
        description: `Marketplace sale: ${quantity}x ${catalogCard.name}`,
        reference_type: 'CARD',
        reference_id: catalogCardId,
        buyer_id: buyerId,
        card_id: catalogCardId
      }, tx),
      recordCommissionTransaction({
        transaction_type: 'COMMISSION',
        amount: totalCommission,
        description: `Commission from ${quantity}x ${catalogCard.name} marketplace purchase (${commission.commission_rate}%)`,
        reference_type: 'CARD',
        reference_id: catalogCardId,
        buyer_id: buyerId,
        card_id: catalogCardId,
        commission_rate: commission.commission_rate
      }, tx)
    ]);

    // Create user cards with proper quantity handling
    const userCards = [];
    for (let i = 0; i < quantity; i++) {
      const userCard = await tx.userCard.create({
        data: {
          owner_id: buyerId,
          card_id: catalogCardId,
          condition: 'Mint',
          is_for_sale: false,
          is_sold: false,
          notes: `Purchased from TCG Market catalog for $${unitPrice.toFixed(2)} (${commission.commission_rate}% commission) - ${new Date().toLocaleDateString()}`,
          acquired_date: new Date()
        }
      });

      userCards.push(userCard);
    }

    // Record transaction
    await tx.walletTransaction.create({
      data: {
        user_id: buyerId,
        wallet_id: buyerWallet.id,
        transaction_type: 'CATALOG_PURCHASE',
        amount: -totalCost,
        balance_before: buyerBalance,
        balance_after: buyerBalance - totalCost,
        description: `Purchased ${quantity}x ${catalogCard.name} from catalog (includes ${commission.commission_rate}% commission)`,
        reference_type: 'CARD',
        reference_id: catalogCardId
      }
    });

    // Record history for each card
    for (const userCard of userCards) {
      await tx.cardTransactionHistory.create({
        data: {
          userCardId: userCard.id,
          fromUserId: null, // From platform
          toUserId: buyerId,
          action: 'CATALOG_PURCHASE',
          notes: `Card purchased from catalog for $${unitPrice.toFixed(2)} (${commission.commission_rate}% commission)`
        }
      });
    }

    console.log(`Catalog purchase completed successfully with commission system.`);

    return NextResponse.json({
      success: true,
      message: `Successfully purchased ${quantity}x ${catalogCard.name}!`,
      purchase_details: {
        card_name: catalogCard.name,
        quantity: quantity,
        unit_price: unitPrice.toFixed(2),
        commission_rate: commission.commission_rate.toFixed(2),
        commission_per_card: commission.admin_receives.toFixed(2),
        cost_per_card: totalCostPerCard.toFixed(2),
        total_cost: totalCost.toFixed(2),
        total_commission: totalCommission.toFixed(2),
        condition: 'Mint',
        cards_added_to_collection: userCards.length,
        remaining_balance: (buyerBalance - totalCost).toFixed(2),
        user_card_ids: userCards.map(uc => uc.id),
        catalog_purchase: true
      }
    });
  });
}