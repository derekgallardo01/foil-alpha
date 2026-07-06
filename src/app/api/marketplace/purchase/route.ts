// Fix for TypeScript error in marketplace/purchase/route.ts
// Replace the problematic whereClause building section with this:

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '../../../lib/prisma';
import { calculateCommission, recordCommissionTransaction } from '../../../lib/commission-utils';
import type { Prisma } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    // Get session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in.' },
        { status: 401 }
      );
    }

    const userId = parseInt(session.user.id);
    const userName = session.user.name || 'Unknown User';

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

// Fixed purchaseUserCard function with proper TypeScript types
async function purchaseUserCard(buyerId: number, userCardId: number) {
  return await prisma.$transaction(async (tx) => {
    console.log(`🔍 Starting purchase: Buyer ${buyerId}, Card ${userCardId}`);

    // Get user card and verify it's still available
    const userCard = await tx.userCard.findFirst({
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

    // Get related data
    const [card, owner] = await Promise.all([
      tx.card.findUnique({
        where: { id: userCard.card_id },
        select: {
          id: true,
          name: true,
          rarity: true,
          market_price: true
        }
      }),
      tx.user.findUnique({
        where: { id: userCard.owner_id },
        select: {
          id: true,
          name: true
        }
      })
    ]);

    if (!card || !owner) {
      throw new Error('Card or owner not found');
    }

    const cardPrice = Number(userCard.fixed_price || 0);
    console.log(`💰 Card price: $${cardPrice}`);

    // Calculate commission
    const commission = await calculateCommission(cardPrice, card.rarity);

    // Get buyer's wallet
    let buyerWallet = await tx.userWallet.findUnique({
      where: { user_id: buyerId }
    });

    if (!buyerWallet) {
      buyerWallet = await tx.userWallet.create({
        data: {
          user_id: buyerId,
          balance: 1000,
          frozen_balance: 0
        }
      });
    }

    const buyerBalance = Number(buyerWallet.balance);

    if (buyerBalance < cardPrice) {
      throw new Error(`Insufficient funds. Required: $${cardPrice.toFixed(2)}, Available: $${buyerBalance.toFixed(2)}`);
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
    await Promise.all([
      tx.userWallet.update({
        where: { user_id: buyerId },
        data: { balance: { decrement: cardPrice } }
      }),
      tx.userWallet.update({
        where: { user_id: userCard.owner_id },
        data: { balance: { increment: commission.seller_receives } }
      })
    ]);

    // *** CRITICAL FIX: TRANSFER OWNERSHIP AND REMOVE FROM MARKETPLACE ***
    const updatedCard = await tx.userCard.update({
      where: { id: userCardId },
      data: {
        owner_id: buyerId,           // ✅ Transfer ownership to buyer
        is_for_sale: false,         // ✅ REMOVE from marketplace  
        is_sold: true,              // ✅ Mark as sold
        sale_type: null,            // ✅ Clear sale type
        fixed_price: null,          // ✅ Clear price
        reserve_price: null,        // ✅ Clear reserve price
        auction_end: null,          // ✅ Clear auction end
        notes: `Purchased from ${owner.name} for $${cardPrice.toFixed(2)} on ${new Date().toLocaleDateString()}`
      }
    });

    console.log(`✅ Card ownership transferred:`, {
      cardId: userCardId,
      fromOwner: userCard.owner_id,
      toOwner: buyerId,
      removedFromMarketplace: !updatedCard.is_for_sale,
      markedAsSold: updatedCard.is_sold
    });

    // Record commission transaction
    await recordCommissionTransaction({
      transaction_type: 'COMMISSION',
      amount: commission.commission_amount,
      description: `Commission from ${card.name} user-to-user sale`,
      reference_type: 'USER_CARD',
      reference_id: userCardId,
      user_card_id: userCardId,
      buyer_id: buyerId,
      seller_id: userCard.owner_id,
      card_id: card.id,
      commission_rate: commission.commission_rate
    }, tx);

    // Record wallet transactions
    await Promise.all([
      tx.walletTransaction.create({
        data: {
          user_id: buyerId,
          wallet_id: buyerWallet.id,
          transaction_type: 'PURCHASE',
          amount: -cardPrice,
          balance_before: buyerBalance,
          balance_after: buyerBalance - cardPrice,
          description: `Purchased ${card.name} from ${owner.name}`,
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
          description: `Sold ${card.name} (after commission)`,
          reference_type: 'USER_CARD',
          reference_id: userCardId
        }
      })
    ]);

    // Record transaction history
    await tx.cardTransactionHistory.create({
      data: {
        userCardId: userCardId,
        fromUserId: userCard.owner_id,
        toUserId: buyerId,
        action: 'PURCHASE',
        notes: `Card purchased for $${cardPrice.toFixed(2)} with ${commission.commission_rate}% commission - ownership transferred, removed from marketplace`
      }
    });

    // Create notifications
    await Promise.all([
      tx.notification.create({
        data: {
          user_id: buyerId,
          type: 'PURCHASE_SUCCESS',
          title: '🎉 Card Purchased Successfully!',
          message: `You successfully purchased ${card.name} for $${cardPrice.toFixed(2)}. The card is now in your collection.`,
          data: {
            card_name: card.name,
            amount_paid: cardPrice,
            seller_name: owner.name,
            card_id: card.id,
            user_card_id: userCardId,
            ownership_transferred: true
          }
        }
      }),
      tx.notification.create({
        data: {
          user_id: userCard.owner_id,
          type: 'SALE_SUCCESS',
          title: '💰 Card Sold Successfully!',
          message: `Your ${card.name} was sold for $${cardPrice.toFixed(2)}. You received $${commission.seller_receives.toFixed(2)} after commission.`,
          data: {
            card_name: card.name,
            sale_price: cardPrice,
            amount_received: commission.seller_receives,
            commission_rate: commission.commission_rate,
            buyer_name: 'Anonymous',
            card_id: card.id,
            removed_from_marketplace: true
          }
        }
      })
    ]);

    console.log(`✅ Purchase completed successfully: Card ${userCardId} transferred from user ${userCard.owner_id} to user ${buyerId}, removed from marketplace`);

    return NextResponse.json({
      success: true,
      message: 'Card purchased and transferred successfully!',
      purchase_details: {
        card_name: card.name,
        card_price: cardPrice.toFixed(2),
        total_paid: cardPrice.toFixed(2),
        seller_receives: commission.seller_receives.toFixed(2),
        commission_rate: commission.commission_rate.toFixed(2),
        ownership_transferred: true,
        removed_from_marketplace: !updatedCard.is_for_sale, // Should be true
        buyer_new_balance: (buyerBalance - cardPrice).toFixed(2),
        transaction_id: userCardId,
        marketplace_status: {
          was_for_sale: userCard.is_for_sale,
          now_for_sale: updatedCard.is_for_sale,
          was_sold: userCard.is_sold,
          now_sold: updatedCard.is_sold
        }
      }
    });
  });
}

// Fixed purchaseCatalogCard function with proper types
async function purchaseCatalogCard(buyerId: number, catalogCardId: number, quantity: number) {
  return await prisma.$transaction(async (tx) => {
    console.log(`Processing catalog purchase: Buyer ${buyerId}, Card ${catalogCardId}, Qty ${quantity}`);

    const catalogCard = await tx.card.findUnique({
      where: { id: catalogCardId },
      select: {
        id: true,
        name: true,
        rarity: true,
        market_price: true
      }
    });

    if (!catalogCard) {
      throw new Error('Card not found');
    }

    if (!catalogCard.market_price || Number(catalogCard.market_price) <= 0) {
      throw new Error('Card price not set');
    }

    const unitPrice = Number(catalogCard.market_price);
    const commission = await calculateCommission(unitPrice, catalogCard.rarity);
    // Seller-funded model: buyer pays exactly the listed price.
    const totalCostPerCard = unitPrice;
    const totalCost = totalCostPerCard * quantity;
    const totalCommission = commission.admin_receives * quantity;

    // Get or create buyer's wallet
    let buyerWallet = await tx.userWallet.findUnique({
      where: { user_id: buyerId }
    });

    if (!buyerWallet) {
      buyerWallet = await tx.userWallet.create({
        data: {
          user_id: buyerId,
          balance: 1000,
          frozen_balance: 0
        }
      });
    }

    const buyerBalance = Number(buyerWallet.balance);

    if (buyerBalance < totalCost) {
      throw new Error(`Insufficient funds. Required: $${totalCost.toFixed(2)}, Available: $${buyerBalance.toFixed(2)}`);
    }

    // Update wallet
    await tx.userWallet.update({
      where: { user_id: buyerId },
      data: { balance: { decrement: totalCost } }
    });

    // Record transactions
    await Promise.all([
      recordCommissionTransaction({
        transaction_type: 'MARKETPLACE_SALE',
        amount: unitPrice * quantity,
        description: `Marketplace sale: ${quantity}x ${catalogCard.name}`,
        reference_type: 'CARD',
        reference_id: catalogCardId,
        buyer_id: buyerId,
        card_id: catalogCardId
      }, tx),
      recordCommissionTransaction({
        transaction_type: 'COMMISSION',
        amount: totalCommission,
        description: `Commission from ${quantity}x ${catalogCard.name} purchase`,
        reference_type: 'CARD',
        reference_id: catalogCardId,
        buyer_id: buyerId,
        card_id: catalogCardId,
        commission_rate: commission.commission_rate
      }, tx)
    ]);

    // Create user cards
    const userCards = [];
    for (let i = 0; i < quantity; i++) {
      const userCard = await tx.userCard.create({
        data: {
          owner_id: buyerId,
          card_id: catalogCardId,
          condition: 'Mint',
          is_for_sale: false,
          is_sold: false,
          notes: `Purchased from catalog for $${unitPrice.toFixed(2)} on ${new Date().toLocaleDateString()}`,
          acquired_date: new Date()
        }
      });
      userCards.push(userCard);
    }

    // Record wallet transaction
    await tx.walletTransaction.create({
      data: {
        user_id: buyerId,
        wallet_id: buyerWallet.id,
        transaction_type: 'CATALOG_PURCHASE',
        amount: -totalCost,
        balance_before: buyerBalance,
        balance_after: buyerBalance - totalCost,
        description: `Purchased ${quantity}x ${catalogCard.name} from catalog`,
        reference_type: 'CARD',
        reference_id: catalogCardId
      }
    });

    // Record history
    for (const userCard of userCards) {
      await tx.cardTransactionHistory.create({
        data: {
          userCardId: userCard.id,
          fromUserId: null,
          toUserId: buyerId,
          action: 'CATALOG_PURCHASE',
          notes: `Card purchased from catalog for $${unitPrice.toFixed(2)}`
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully purchased ${quantity}x ${catalogCard.name}!`,
      purchase_details: {
        card_name: catalogCard.name,
        quantity: quantity,
        unit_price: unitPrice.toFixed(2),
        total_cost: totalCost.toFixed(2),
        condition: 'Mint',
        cards_added_to_collection: userCards.length,
        remaining_balance: (buyerBalance - totalCost).toFixed(2),
        catalog_purchase: true
      }
    });
  });
}