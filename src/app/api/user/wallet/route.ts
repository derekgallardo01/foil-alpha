// src/app/api/user/wallet/route.ts - Simplified version
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const user = auth.user;

    const userId = user.id;
    const userName = user.name || 'Unknown';

    console.log(`🔍 DEBUG: Wallet API called`);
    console.log(`👤 User: ${userName} (ID: ${userId})`);
    console.log(`🕐 Timestamp: ${new Date().toISOString()}`);

    // Check if user is admin
    if (user.role === 'admin') {
      return NextResponse.json({
        error: 'Admins do not have wallets',
        message: 'Use admin panel to manage user wallets'
      }, { status: 403 });
    }

    // Get user's wallet with explicit logging
    const wallet = await prisma.userWallet.findUnique({
      where: { user_id: userId }
    });

    console.log(`👛 Raw wallet from database:`, {
      found: !!wallet,
      wallet_id: wallet?.id,
      balance: wallet ? Number(wallet.balance) : 'N/A',
      frozen_balance: wallet ? Number(wallet.frozen_balance) : 'N/A',
      created_at: wallet?.created_at,
      updated_at: wallet?.updated_at
    });

    if (!wallet) {
      console.log(`❌ No wallet found for user ${userId}`);
      return NextResponse.json({
        error: 'Wallet not found',
        message: 'Contact admin to create your wallet'
      }, { status: 404 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const includeTransactions = searchParams.get('include_transactions') === 'true';
    const transactionLimit = parseInt(searchParams.get('limit') || '10');

    let recentTransactions: any[] = [];
    if (includeTransactions) {
      recentTransactions = await prisma.walletTransaction.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take: transactionLimit,
        select: {
          id: true,
          transaction_type: true,
          amount: true,
          description: true,
          created_at: true,
          reference_type: true,
          balance_before: true,
          balance_after: true
        }
      });

      console.log(`📊 Recent transactions:`, {
        count: recentTransactions.length,
        latest: recentTransactions[0] ? {
          id: recentTransactions[0].id,
          type: recentTransactions[0].transaction_type,
          amount: Number(recentTransactions[0].amount),
          description: recentTransactions[0].description,
          balance_before: Number(recentTransactions[0].balance_before),
          balance_after: Number(recentTransactions[0].balance_after),
          created_at: recentTransactions[0].created_at
        } : 'None'
      });
    }

    const walletData = {
      balance: Number(wallet.balance),
      frozen_balance: Number(wallet.frozen_balance),
      available_balance: Number(wallet.balance) - Number(wallet.frozen_balance),
      recent_transactions: recentTransactions.map(tx => ({
        id: tx.id,
        type: tx.transaction_type,
        amount: Number(tx.amount),
        description: tx.description || '',
        created_at: tx.created_at,
        reference_type: tx.reference_type || '',
        balance_before: Number(tx.balance_before || 0),
        balance_after: Number(tx.balance_after || 0)
      }))
    };

    console.log(`📤 Sending wallet data:`, {
      balance: walletData.balance,
      frozen_balance: walletData.frozen_balance,
      available_balance: walletData.available_balance,
      transaction_count: walletData.recent_transactions.length
    });

    return NextResponse.json(walletData);

  } catch (error) {
    console.error('❌ Wallet API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const user = auth.user;

    const userId = user.id;

    // Check if user is admin - admins don't have wallets
    if (user.role === 'admin') {
      return NextResponse.json({
        error: 'Admins cannot perform wallet operations on themselves'
      }, { status: 403 });
    }

    const body = await request.json();
    const { action, amount } = body;

    if (action === 'add_funds') {
      // Free self-credit is a DEV-ONLY convenience. In production, funds may only
      // enter the wallet via a real Stripe deposit (see /api/wallet/deposit) —
      // otherwise users could mint balance and cash it out via withdrawals.
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'Add funds with a card via the deposit flow.' },
          { status: 403 }
        );
      }

      const addAmount = parseFloat(amount);
      if (addAmount <= 0) {
        return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
      }

      // Get wallet
      const wallet = await prisma.userWallet.findUnique({
        where: { user_id: userId }
      });

      if (!wallet) {
        return NextResponse.json({
          error: 'Wallet not found. Contact admin.'
        }, { status: 404 });
      }

      const oldBalance = Number(wallet.balance);
      const newBalance = oldBalance + addAmount;

      // Update wallet and create transaction
      await prisma.$transaction(async (tx) => {
        await tx.userWallet.update({
          where: { user_id: userId },
          data: { balance: newBalance }
        });

        await tx.walletTransaction.create({
          data: {
            user_id: userId,
            wallet_id: wallet.id,
            transaction_type: 'DEPOSIT',
            amount: addAmount,
            balance_before: oldBalance,
            balance_after: newBalance,
            description: 'Self-deposit',
            reference_type: 'USER_DEPOSIT'
          }
        });
      });

      return NextResponse.json({
        success: true,
        message: `Added $${addAmount.toFixed(2)} to wallet`,
        new_balance: newBalance
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error updating wallet:', error);
    return NextResponse.json(
      { error: 'Failed to update wallet' },
      { status: 500 }
    );
  }
}