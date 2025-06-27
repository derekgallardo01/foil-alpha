// src/app/api/marketplace/purchase/route.ts - Updated with NextAuth integration
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '../../../lib/prisma';
import { getCurrentDevUserForAPI, isDevMode } from '../../../lib/dev-auth';

export async function POST(request: NextRequest) {
  try {
    // Get user session with dev mode support
    let userId: number;
    let userName: string;

    if (isDevMode()) {
      const devUser = getCurrentDevUserForAPI();
      if (!devUser) {
        return NextResponse.json(
          { error: 'Dev mode: No dev user configured' },
          { status: 401 }
        );
      }
      userId = devUser.id;
      userName = devUser.name;
      console.log(`🚧 DEV MODE: Using dev user ${devUser.email} (ID: ${userId})`);
    } else {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      userId = parseInt(session.user.id);
      userName = session.user.name || 'Unknown User';
    }

    const body = await request.json();
    const { user_card_id, catalog_card_id, quantity = 1 } = body;

    console.log('Purchase request:', {
      userId,
      userName,
      user_card_id,
      catalog_card_id,
      quantity
    });

    // Handle different purchase types
    if (user_card_id) {
      // Purchase user-owned card (existing functionality)
      return await purchaseUserCard(userId, user_card_id);
    } else if (catalog_card_id) {
      // Purchase catalog card (new functionality)
      return await purchaseCatalogCard(userId, catalog_card_id, quantity);
    } else {
      return NextResponse.json(
        { error: 'Either user_card_id or catalog_card_id must be provided' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Purchase error:', error);
    return NextResponse.json(
      { error: 'Failed to process purchase' },
      { status: 500 }
    );
  }
}

// Purchase user-owned card (existing resale functionality)
async function purchaseUserCard(buyerId: number, userCardId: number) {
  return await prisma.$transaction(async (tx) => {
    console.log(`Processing user card purchase: Buyer ${buyerId}, UserCard ${userCardId}`);

    // Get the user card with owner and card details
    const userCard = await tx.userCard.findUnique({
      where: { id: userCardId },
      include: {
        card: true,
        owner: true
      }
    });

    if (!userCard) {
      throw new Error('Card not found');
    }

    if (!userCard.is_for_sale) {
      throw new Error('Card is not for sale');
    }

    if (userCard.is_sold) {
      throw new Error('Card has already been sold');
    }

    if (userCard.owner_id === buyerId) {
      throw new Error('You cannot buy your own card');
    }

    // Check if it's an auction and if it's still active
    if (userCard.sale_type === 'AUCTION') {
      if (!userCard.auction_end || new Date(userCard.auction_end) <= new Date()) {
        throw new Error('Auction has ended');
      }
      throw new Error('This is an auction card. Please place a bid instead of purchasing directly.');
    }

    const purchasePrice = Number(userCard.fixed_price || 0);

    if (purchasePrice <= 0) {
      throw new Error('Invalid purchase price');
    }

    // Get buyer's wallet
    let buyerWallet = await tx.userWallet.findUnique({
      where: { user_id: buyerId }
    });

    if (!buyerWallet) {
      // Create buyer wallet if it doesn't exist
      console.log(`Creating wallet for buyer ${buyerId}`);
      buyerWallet = await tx.userWallet.create({
        data: {
          user_id: buyerId,
          balance: 0,
          frozen_balance: 0
        }
      });
    }

    const buyerBalance = Number(buyerWallet.balance);
    if (buyerBalance < purchasePrice) {
      throw new Error(`Insufficient funds. Required: $${purchasePrice.toFixed(2)}, Available: $${buyerBalance.toFixed(2)}`);
    }

    // Get seller's wallet
    let sellerWallet = await tx.userWallet.findUnique({
      where: { user_id: userCard.owner_id }
    });

    if (!sellerWallet) {
      // Create seller wallet if it doesn't exist
      console.log(`Creating wallet for seller ${userCard.owner_id}`);
      sellerWallet = await tx.userWallet.create({
        data: {
          user_id: userCard.owner_id,
          balance: 0,
          frozen_balance: 0
        }
      });
    }

    // Calculate transaction fees (5% marketplace fee)
    const marketplaceFee = purchasePrice * 0.05;
    const sellerReceives = purchasePrice - marketplaceFee;

    // Update buyer's wallet
    await tx.userWallet.update({
      where: { user_id: buyerId },
      data: {
        balance: { decrement: purchasePrice }
      }
    });

    // Update seller's wallet
    await tx.userWallet.update({
      where: { user_id: userCard.owner_id },
      data: {
        balance: { increment: sellerReceives }
      }
    });

    // Transfer card ownership
    await tx.userCard.update({
      where: { id: userCardId },
      data: {
        owner_id: buyerId,
        is_for_sale: false,
        is_sold: true,
        sale_type: null,
        fixed_price: null,
        auction_end: null,
        notes: `Purchased from ${userCard.owner.name} for $${purchasePrice.toFixed(2)}`
      }
    });

    // Record wallet transactions
    await Promise.all([
      // Buyer transaction
      tx.walletTransaction.create({
        data: {
          user_id: buyerId,
          wallet_id: buyerWallet.id,
          transaction_type: 'PURCHASE',
          amount: -purchasePrice,
          balance_before: buyerBalance,
          balance_after: buyerBalance - purchasePrice,
          description: `Purchased ${userCard.card.name} from ${userCard.owner.name}`,
          reference_type: 'USER_CARD',
          reference_id: userCardId
        }
      }),
      // Seller transaction
      tx.walletTransaction.create({
        data: {
          user_id: userCard.owner_id,
          wallet_id: sellerWallet.id,
          transaction_type: 'SALE',
          amount: sellerReceives,
          balance_before: Number(sellerWallet.balance),
          balance_after: Number(sellerWallet.balance) + sellerReceives,
          description: `Sold ${userCard.card.name} to buyer (after ${(marketplaceFee * 100 / purchasePrice).toFixed(1)}% fee)`,
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
        action: 'PURCHASED',
        notes: `Card purchased for $${purchasePrice.toFixed(2)}`
      }
    });

    console.log(`User card purchase completed: ${userCard.card.name} for $${purchasePrice}`);

    return NextResponse.json({
      success: true,
      message: 'Card purchased successfully!',
      purchase_details: {
        card_name: userCard.card.name,
        purchase_price: purchasePrice.toFixed(2),
        marketplace_fee: marketplaceFee.toFixed(2),
        seller_receives: sellerReceives.toFixed(2),
        seller_name: userCard.owner.name,
        transaction_id: userCardId
      }
    });
  });
}

// Purchase catalog card (new functionality for fresh cards)
async function purchaseCatalogCard(buyerId: number, catalogCardId: number, quantity: number) {
  return await prisma.$transaction(async (tx) => {
    console.log(`Processing catalog purchase: Buyer ${buyerId}, Card ${catalogCardId}, Qty ${quantity}`);

    // Get the catalog card
    const catalogCard = await tx.card.findUnique({
      where: { id: catalogCardId },
      include: {
        pokemonSet: true,
        rarity_ref: true
      }
    });

    if (!catalogCard) {
      throw new Error('Card not found');
    }

    if (!catalogCard.market_price || Number(catalogCard.market_price) <= 0) {
      throw new Error('Card price not set');
    }

    const unitPrice = Number(catalogCard.market_price);
    const totalPrice = unitPrice * quantity;

    console.log(`Card: ${catalogCard.name}, Unit Price: $${unitPrice}, Total: $${totalPrice}`);

    // Get buyer's wallet
    let buyerWallet = await tx.userWallet.findUnique({
      where: { user_id: buyerId }
    });

    if (!buyerWallet) {
      // Create wallet if it doesn't exist
      console.log(`Creating wallet for buyer ${buyerId}`);
      buyerWallet = await tx.userWallet.create({
        data: {
          user_id: buyerId,
          balance: 0,
          frozen_balance: 0
        }
      });
    }

    const buyerBalance = Number(buyerWallet.balance);
    console.log(`Buyer balance: $${buyerBalance}, Required: $${totalPrice}`);

    if (buyerBalance < totalPrice) {
      throw new Error(`Insufficient funds. Required: $${totalPrice.toFixed(2)}, Available: $${buyerBalance.toFixed(2)}`);
    }

    // Update buyer's wallet
    await tx.userWallet.update({
      where: { user_id: buyerId },
      data: {
        balance: { decrement: totalPrice }
      }
    });

    console.log(`Updated wallet balance from $${buyerBalance} to $${buyerBalance - totalPrice}`);

    // Create user card entries for the purchased quantity
    const userCards = [];
    for (let i = 0; i < quantity; i++) {
      console.log(`Creating UserCard ${i + 1} of ${quantity}`);

      const userCard = await tx.userCard.create({
        data: {
          owner_id: buyerId,
          card_id: catalogCardId,
          condition: 'Mint', // New cards are mint condition
          is_for_sale: false,
          is_sold: false,
          sale_type: null,
          fixed_price: null,
          reserve_price: null,
          auction_end: null,
          notes: `Purchased from TCG Market catalog for $${unitPrice.toFixed(2)}`,
          acquired_date: new Date()
        }
      });

      console.log(`Created UserCard ID: ${userCard.id}`);
      userCards.push(userCard);
    }

    // Record wallet transaction
    const walletTransaction = await tx.walletTransaction.create({
      data: {
        user_id: buyerId,
        wallet_id: buyerWallet.id,
        transaction_type: 'CATALOG_PURCHASE',
        amount: -totalPrice,
        balance_before: buyerBalance,
        balance_after: buyerBalance - totalPrice,
        description: `Purchased ${quantity}x ${catalogCard.name} from catalog`,
        reference_type: 'CARD',
        reference_id: catalogCardId
      }
    });

    console.log(`Created wallet transaction ID: ${walletTransaction.id}`);

    // Record transaction history for each card
    for (const userCard of userCards) {
      await tx.cardTransactionHistory.create({
        data: {
          userCardId: userCard.id,
          fromUserId: null, // No previous owner (catalog purchase)
          toUserId: buyerId,
          action: 'CATALOG_PURCHASE',
          notes: `Card purchased from catalog for $${unitPrice.toFixed(2)}`
        }
      });
    }

    console.log(`Catalog purchase completed successfully. Created ${userCards.length} UserCard entries.`);

    return NextResponse.json({
      success: true,
      message: `Successfully purchased ${quantity}x ${catalogCard.name}!`,
      purchase_details: {
        card_name: catalogCard.name,
        quantity: quantity,
        unit_price: unitPrice.toFixed(2),
        total_price: totalPrice.toFixed(2),
        condition: 'Mint',
        cards_added_to_collection: userCards.length,
        remaining_balance: (buyerBalance - totalPrice).toFixed(2),
        user_card_ids: userCards.map(uc => uc.id)
      }
    });
  });
}