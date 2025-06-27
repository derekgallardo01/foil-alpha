// src/app/api/user/wallet/route.ts - Simplified version
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '../../../lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);

    // Check if user is admin - admins don't have wallets
    if (session.user.role === 'admin') {
      return NextResponse.json({
        error: 'Admins do not have wallets',
        message: 'Use admin panel to manage user wallets'
      }, { status: 403 });
    }

    console.log(`Fetching wallet for user ${userId}`);

    // Get user's wallet
    const wallet = await prisma.userWallet.findUnique({
      where: { user_id: userId }
    });

    if (!wallet) {
      return NextResponse.json({
        error: 'Wallet not found',
        message: 'Contact admin to create your wallet'
      }, { status: 404 });
    }

    // Parse query parameters for transactions
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
          reference_type: true
        }
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
        reference_type: tx.reference_type || ''
      }))
    };

    return NextResponse.json(walletData);

  } catch (error) {
    console.error('Error fetching wallet:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);

    // Check if user is admin - admins don't have wallets
    if (session.user.role === 'admin') {
      return NextResponse.json({
        error: 'Admins cannot perform wallet operations on themselves'
      }, { status: 403 });
    }

    const body = await request.json();
    const { action, amount } = body;

    if (action === 'add_funds') {
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