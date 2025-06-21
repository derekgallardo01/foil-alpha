import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '../../../lib/prisma';

// Define interfaces for type safety
interface WalletResponse {
  balance: number;
  frozen_balance: number;
  available_balance: number;
  created_at: Date;
  updated_at: Date;
  recent_transactions?: TransactionResponse[];
}

interface TransactionResponse {
  id: number;
  type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string | null; // Allow null to match Prisma schema
  created_at: Date;
  reference_type: string | null; // Allow null to match Prisma schema
}

// GET /api/user/wallet - Get user's wallet balance and transactions
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const { searchParams } = new URL(request.url);
    const includeTransactions = searchParams.get('include_transactions') === 'true';
    const transactionLimit = parseInt(searchParams.get('limit') || '10');

    // Get or create wallet
    let wallet = await prisma.userWallet.findUnique({
      where: { user_id: userId }
    });

    if (!wallet) {
      wallet = await prisma.userWallet.create({
        data: {
          user_id: userId,
          balance: 0.00,
          frozen_balance: 0.00
        }
      });

      // Create initial setup transaction
      await prisma.walletTransaction.create({
        data: {
          user_id: userId,
          transaction_type: 'WALLET_SETUP',
          amount: 0.00,
          balance_before: 0.00,
          balance_after: 0.00,
          description: 'Wallet created automatically',
          reference_type: 'SYSTEM_SETUP'
        }
      });
    }

    const result: WalletResponse = {
      balance: Number(wallet.balance),
      frozen_balance: Number(wallet.frozen_balance),
      available_balance: Number(wallet.balance) - Number(wallet.frozen_balance),
      created_at: wallet.created_at,
      updated_at: wallet.updated_at
    };

    // Include recent transactions if requested
    if (includeTransactions) {
      const transactions = await prisma.walletTransaction.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take: transactionLimit,
        select: {
          id: true,
          transaction_type: true,
          amount: true,
          balance_before: true,
          balance_after: true,
          description: true,
          created_at: true,
          reference_type: true
        }
      });

      result.recent_transactions = transactions.map(tx => ({
        id: tx.id,
        type: tx.transaction_type,
        amount: Number(tx.amount),
        balance_before: Number(tx.balance_before),
        balance_after: Number(tx.balance_after),
        description: tx.description,
        created_at: tx.created_at,
        reference_type: tx.reference_type
      }));
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching wallet:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet' },
      { status: 500 }
    );
  }
}

// POST /api/user/wallet - User wallet operations (limited)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { operation } = body;

    // Users can only check balance or request wallet info
    if (operation === 'CHECK_BALANCE') {
      const userId = parseInt(session.user.id);

      const wallet = await prisma.userWallet.findUnique({
        where: { user_id: userId }
      });

      if (!wallet) {
        return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
      }

      return NextResponse.json({
        balance: Number(wallet.balance),
        frozen_balance: Number(wallet.frozen_balance),
        available_balance: Number(wallet.balance) - Number(wallet.frozen_balance)
      });
    }

    return NextResponse.json({
      error: 'Invalid operation. Users can only check balance.'
    }, { status: 400 });
  } catch (error) {
    console.error('Error in user wallet operation:', error);
    return NextResponse.json(
      { error: 'Failed to perform wallet operation' },
      { status: 500 }
    );
  }
}