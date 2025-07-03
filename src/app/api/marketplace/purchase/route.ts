// src/app/api/marketplace/purchase/route.ts - Next.js 15 compatible
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '../../../lib/prisma';

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

// Purchase user-owned card
async function purchaseUserCard(buyerId: number, userCardId: number) {
  return await prisma.$transaction(async (tx) => {
    console.log(`Processing user card purchase: Buyer ${buyerId}, UserCard ${userCardId}`);

    // Get user card without problematic includes
    const userCard = await tx.userCard.findUnique({
      where: { id: userCardId }
    });

    if (!userCard) {
      throw new Error('Card not found');
    }

    // Get related data separately
    const card = await tx.card.findUnique({
      where: { id: userCard.card_id }
    });

    const owner = await tx.user.findUnique({
      where: { id: userCard.owner_id }
    });

    if (!card || !owner) {
      throw new Error('Card or owner not found');
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

    if (userCard.sale_type === 'AUCTION') {
      if (!userCard.auction_end || new Date(userCard.auction_end) <= new Date()) {
        throw new Error('Auction has ended');
      }
      throw new Error('This is an auction card. Please place a bid instead.');
    }

    const purchasePrice = Number(userCard.fixed_price || 0);
    if (purchasePrice <= 0) {
      throw new Error('Invalid purchase price');
    }

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
    if (buyerBalance < purchasePrice) {
      throw new Error(`Insufficient funds. Required: $${purchasePrice.toFixed(2)}, Available: $${buyerBalance.toFixed(2)}`);
    }

    // Get or create seller's wallet
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

    // Calculate fees (5% marketplace fee)
    const marketplaceFee = purchasePrice * 0.05;
    const sellerReceives = purchasePrice - marketplaceFee;

    // Update wallets
    await tx.userWallet.update({
      where: { user_id: buyerId },
      data: { balance: { decrement: purchasePrice } }
    });

    await tx.userWallet.update({
      where: { user_id: userCard.owner_id },
      data: { balance: { increment: sellerReceives } }
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
        notes: `Purchased from ${owner.name} for $${purchasePrice.toFixed(2)}`
      }
    });

    // Record transactions
    await Promise.all([
      tx.walletTransaction.create({
        data: {
          user_id: buyerId,
          wallet_id: buyerWallet.id,
          transaction_type: 'PURCHASE',
          amount: -purchasePrice,
          balance_before: buyerBalance,
          balance_after: buyerBalance - purchasePrice,
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
          amount: sellerReceives,
          balance_before: Number(sellerWallet.balance),
          balance_after: Number(sellerWallet.balance) + sellerReceives,
          description: `Sold ${card.name} (after 5% marketplace fee)`,
          reference_type: 'USER_CARD',
          reference_id: userCardId
        }
      })
    ]);

    // Record history
    await tx.cardTransactionHistory.create({
      data: {
        userCardId: userCardId,
        fromUserId: userCard.owner_id,
        toUserId: buyerId,
        action: 'PURCHASED',
        notes: `Card purchased for $${purchasePrice.toFixed(2)}`
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Card purchased successfully!',
      purchase_details: {
        card_name: card.name,
        purchase_price: purchasePrice.toFixed(2),
        marketplace_fee: marketplaceFee.toFixed(2),
        seller_receives: sellerReceives.toFixed(2),
        seller_name: owner.name,
        transaction_id: userCardId
      }
    });
  });
}

// Purchase catalog card
async function purchaseCatalogCard(buyerId: number, catalogCardId: number, quantity: number) {
  return await prisma.$transaction(async (tx) => {
    console.log(`Processing catalog purchase: Buyer ${buyerId}, Card ${catalogCardId}, Qty ${quantity}`);

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
    const totalPrice = unitPrice * quantity;

    console.log(`Card: ${catalogCard.name}, Unit Price: $${unitPrice}, Total: $${totalPrice}`);

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
    console.log(`Buyer balance: $${buyerBalance}, Required: $${totalPrice}`);

    if (buyerBalance < totalPrice) {
      throw new Error(`Insufficient funds. Required: $${totalPrice.toFixed(2)}, Available: $${buyerBalance.toFixed(2)}`);
    }

    // Update wallet
    await tx.userWallet.update({
      where: { user_id: buyerId },
      data: { balance: { decrement: totalPrice } }
    });

    console.log(`Updated wallet balance from $${buyerBalance} to $${buyerBalance - totalPrice}`);

    // Create user cards
    const userCards = [];
    for (let i = 0; i < quantity; i++) {
      console.log(`Creating UserCard ${i + 1} of ${quantity}`);

      const userCard = await tx.userCard.create({
        data: {
          owner_id: buyerId,
          card_id: catalogCardId,
          condition: 'Mint',
          is_for_sale: false,
          is_sold: false,
          notes: `Purchased from TCG Market catalog for $${unitPrice.toFixed(2)}`,
          acquired_date: new Date()
        }
      });

      console.log(`Created UserCard ID: ${userCard.id}`);
      userCards.push(userCard);
    }

    // Record transaction
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

    // Record history for each card
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