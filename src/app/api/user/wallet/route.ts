// src/app/api/user/wallet/route.ts - Updated with NextAuth integration
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '../../../lib/prisma';
import { getCurrentDevUserForAPI, isDevMode } from '../../../lib/dev-auth';


export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Wallet GET API called');
    console.log('🔍 Dev mode enabled:', isDevMode());
    console.log('🔍 Environment ENABLE_DEV_AUTH:', process.env.ENABLE_DEV_AUTH);
    console.log('🔍 Environment DEV_USER_EMAIL:', process.env.DEV_USER_EMAIL);

    // Get user session with dev mode support
    let userId: number;
    let userEmail: string;

    if (isDevMode()) {
      console.log('🚧 Using dev mode authentication');
      const devUser = getCurrentDevUserForAPI();
      if (!devUser) {
        console.error('❌ Dev mode: No dev user configured');
        return NextResponse.json({
          error: 'Dev mode: No dev user configured',
          debug: {
            devMode: isDevMode(),
            enableDevAuth: process.env.ENABLE_DEV_AUTH,
            devUserEmail: process.env.DEV_USER_EMAIL
          }
        }, { status: 401 });
      }
      userId = devUser.id;
      userEmail = devUser.email;
      console.log(`🚧 DEV MODE: Wallet API using ${userEmail} (ID: ${userId})`);
    } else {
      console.log('🔐 Using NextAuth session authentication');
      const session = await getServerSession(authOptions);
      console.log('🔍 Session:', session ? 'Found' : 'Not found');
      console.log('🔍 Session user ID:', session?.user?.id);
      console.log('🔍 Session user email:', session?.user?.email);

      if (!session?.user?.id) {
        console.error('❌ No session or user ID found');
        return NextResponse.json({
          error: 'Authentication required',
          debug: {
            sessionExists: !!session,
            userId: session?.user?.id,
            userEmail: session?.user?.email
          }
        }, { status: 401 });
      }
      userId = parseInt(session.user.id);
      userEmail = session.user.email || 'unknown';
      console.log(`🔐 SESSION: Wallet API using ${userEmail} (ID: ${userId})`);
    }

    console.log(`📝 Fetching wallet for user ${userId} (${userEmail})`);

    let wallet = await prisma.userWallet.findUnique({
      where: { user_id: userId },
      include: {
        transactions: {
          orderBy: { created_at: 'desc' },
          take: 10
        }
      }
    });

    if (!wallet) {
      // Create wallet if it doesn't exist
      console.log(`💰 Creating wallet for user ${userId} (${userEmail})`);
      wallet = await prisma.userWallet.create({
        data: {
          user_id: userId,
          balance: 0,
          frozen_balance: 0
        },
        include: {
          transactions: true
        }
      });
      console.log(`✅ Created wallet ID: ${wallet.id}`);
    } else {
      console.log(`✅ Found existing wallet ID: ${wallet.id}, Balance: ${Number(wallet.balance)}`);
    }

    const walletData = {
      wallet_id: wallet.id,
      balance: Number(wallet.balance),
      frozen_balance: Number(wallet.frozen_balance),
      available_balance: Number(wallet.balance) - Number(wallet.frozen_balance),
      transactions: wallet.transactions.map(tx => ({
        id: tx.id,
        type: tx.transaction_type,
        amount: Number(tx.amount),
        description: tx.description,
        created_at: tx.created_at,
        balance_after: Number(tx.balance_after)
      }))
    };

    console.log(`📊 Returning wallet data:`, {
      wallet_id: walletData.wallet_id,
      balance: walletData.balance,
      transaction_count: walletData.transactions.length
    });

    return NextResponse.json(walletData);

  } catch (error) {
    console.error('❌ Error fetching wallet:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    return NextResponse.json(
      {
        error: 'Failed to fetch wallet',
        details: error instanceof Error ? error.message : 'Unknown error',
        debug: {
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          devMode: isDevMode(),
          enableDevAuth: process.env.ENABLE_DEV_AUTH
        }
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Wallet POST API called');

    // Get user session with dev mode support
    let userId: number;
    let userEmail: string;

    if (isDevMode()) {
      const devUser = getCurrentDevUserForAPI();
      if (!devUser) {
        return NextResponse.json({ error: 'Dev mode: No dev user configured' }, { status: 401 });
      }
      userId = devUser.id;
      userEmail = devUser.email;
      console.log(`🚧 DEV MODE: Wallet POST API using ${userEmail} (ID: ${userId})`);
    } else {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      userId = parseInt(session.user.id);
      userEmail = session.user.email || 'unknown';
    }

    const body = await request.json();
    const { action, amount } = body;

    console.log(`📝 Wallet action: ${action}, Amount: ${amount}`);

    if (action === 'add_funds') {
      const addAmount = parseFloat(amount);
      if (addAmount <= 0) {
        return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
      }

      // Get or create wallet
      let wallet = await prisma.userWallet.findUnique({
        where: { user_id: userId }
      });

      if (!wallet) {
        console.log(`💰 Creating wallet for user ${userId} (${userEmail})`);
        wallet = await prisma.userWallet.create({
          data: {
            user_id: userId,
            balance: 0,
            frozen_balance: 0
          }
        });
      }

      const oldBalance = Number(wallet.balance);
      const newBalance = oldBalance + addAmount;

      // Update wallet
      await prisma.userWallet.update({
        where: { user_id: userId },
        data: { balance: newBalance }
      });

      // Record transaction
      await prisma.walletTransaction.create({
        data: {
          user_id: userId,
          wallet_id: wallet.id,
          transaction_type: 'DEPOSIT',
          amount: addAmount,
          balance_before: oldBalance,
          balance_after: newBalance,
          description: isDevMode() ? 'Dev mode funds addition' : 'Manual funds addition',
          reference_type: 'SYSTEM',
          reference_id: null
        }
      });

      console.log(`💰 Added ${addAmount} to wallet for user ${userId} (${userEmail}): ${oldBalance} -> ${newBalance}`);

      return NextResponse.json({
        success: true,
        message: `Added ${addAmount.toFixed(2)} to wallet`,
        new_balance: newBalance
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('❌ Error updating wallet:', error);
    return NextResponse.json(
      {
        error: 'Failed to update wallet',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
