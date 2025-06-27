import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '../../../lib/prisma';

// Define valid wallet operations for type safety
type WalletOperation = 'ADD_MONEY' | 'DEDUCT_MONEY' | 'FREEZE_FUNDS' | 'UNFREEZE_FUNDS';

// POST /api/admin/wallet - Admin wallet operations (NO ADMIN WALLET REQUIRED)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { user_id, operation, amount, description } = body;

        console.log('Admin wallet operation request:', { user_id, operation, amount });

        if (!user_id || !operation || !amount || amount <= 0) {
            return NextResponse.json({
                error: 'user_id, operation, and positive amount are required'
            }, { status: 400 });
        }

        const adminId = parseInt(session.user.id);
        const targetUserId = parseInt(user_id);
        const operationAmount = Number(amount);

        // Validate operation type
        const validOperations: WalletOperation[] = ['ADD_MONEY', 'DEDUCT_MONEY', 'FREEZE_FUNDS', 'UNFREEZE_FUNDS'];
        if (!validOperations.includes(operation)) {
            return NextResponse.json({
                error: 'Invalid operation. Must be ADD_MONEY, DEDUCT_MONEY, FREEZE_FUNDS, or UNFREEZE_FUNDS'
            }, { status: 400 });
        }

        // Verify target user exists
        const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, name: true, email: true, role: true }
        });

        if (!targetUser) {
            return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
        }

        // Prevent operations on admin accounts
        if (targetUser.role === 'admin') {
            return NextResponse.json({ error: 'Cannot perform wallet operations on admin accounts' }, { status: 400 });
        }

        // Get or create user wallet
        let wallet = await prisma.userWallet.findUnique({
            where: { user_id: targetUserId }
        });

        if (!wallet) {
            console.log('Creating new wallet for user:', targetUserId);
            wallet = await prisma.userWallet.create({
                data: {
                    user_id: targetUserId,
                    balance: 0.00,
                    frozen_balance: 0.00
                }
            });
        }

        const currentBalance = Number(wallet.balance);
        const currentFrozen = Number(wallet.frozen_balance);
        let newBalance = currentBalance;
        let newFrozenBalance = currentFrozen;
        let transactionAmount = operationAmount;

        console.log('Current wallet state:', { currentBalance, currentFrozen });

        // Perform operation validation and calculation
        switch (operation) {
            case 'ADD_MONEY':
                // Admin can add money directly - no source wallet required
                newBalance = currentBalance + operationAmount;
                break;

            case 'DEDUCT_MONEY':
                if (currentBalance < operationAmount) {
                    return NextResponse.json({
                        error: `Insufficient balance for deduction. Current balance: $${currentBalance.toFixed(2)}`
                    }, { status: 400 });
                }
                newBalance = currentBalance - operationAmount;
                transactionAmount = -operationAmount; // Negative for deduction
                break;

            case 'FREEZE_FUNDS':
                const availableBalance = currentBalance - currentFrozen;
                if (availableBalance < operationAmount) {
                    return NextResponse.json({
                        error: `Insufficient available balance to freeze. Available: $${availableBalance.toFixed(2)}`
                    }, { status: 400 });
                }
                newFrozenBalance = currentFrozen + operationAmount;
                transactionAmount = 0; // Freeze doesn't change total balance
                break;

            case 'UNFREEZE_FUNDS':
                if (currentFrozen < operationAmount) {
                    return NextResponse.json({
                        error: `Insufficient frozen balance to unfreeze. Frozen: $${currentFrozen.toFixed(2)}`
                    }, { status: 400 });
                }
                newFrozenBalance = currentFrozen - operationAmount;
                transactionAmount = 0; // Unfreeze doesn't change total balance
                break;
        }

        console.log('New wallet state:', { newBalance, newFrozenBalance });

        // Execute transaction
        const result = await prisma.$transaction(async (tx) => {
            // Update wallet
            const updatedWallet = await tx.userWallet.update({
                where: { user_id: targetUserId },
                data: {
                    balance: newBalance,
                    frozen_balance: newFrozenBalance
                }
            });

            // Create wallet transaction record
            const walletTransaction = await tx.walletTransaction.create({
                data: {
                    wallet_id: wallet.id,
                    user_id: targetUserId,
                    transaction_type: operation,
                    amount: transactionAmount,
                    balance_before: currentBalance,
                    balance_after: newBalance,
                    description: description || `Admin ${operation.toLowerCase().replace('_', ' ')}: $${operationAmount.toFixed(2)}`,
                    reference_type: 'ADMIN_OPERATION',
                    admin_id: adminId
                }
            });

            return { wallet: updatedWallet, transaction: walletTransaction };
        });

        console.log('Wallet operation completed successfully');

        return NextResponse.json({
            success: true,
            operation,
            amount: operationAmount,
            user: {
                id: targetUser.id,
                name: targetUser.name,
                email: targetUser.email
            },
            wallet: {
                balance: Number(result.wallet.balance),
                frozen_balance: Number(result.wallet.frozen_balance),
                available_balance: Number(result.wallet.balance) - Number(result.wallet.frozen_balance)
            },
            transaction_id: result.transaction.id,
            message: `Successfully ${operation.toLowerCase().replace('_', ' ')} $${operationAmount.toFixed(2)} for ${targetUser.name}`
        });

    } catch (error) {
        console.error('Error in admin wallet operation:', error);
        return NextResponse.json(
            {
                error: 'Failed to perform wallet operation',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

// GET /api/admin/wallet?user_id=123 - Get wallet details for admin
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('user_id');

        console.log('Admin fetching wallet data for user:', userId);

        if (!userId) {
            return NextResponse.json({ error: 'user_id parameter required' }, { status: 400 });
        }

        const parsedUserId = parseInt(userId);
        if (isNaN(parsedUserId)) {
            return NextResponse.json({ error: 'Invalid user_id format' }, { status: 400 });
        }

        // Get user info
        const user = await prisma.user.findUnique({
            where: { id: parsedUserId },
            select: { id: true, name: true, email: true, role: true }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Get or create wallet
        let wallet = await prisma.userWallet.findUnique({
            where: { user_id: parsedUserId }
        });

        if (!wallet) {
            console.log('Wallet not found, creating new one');
            wallet = await prisma.userWallet.create({
                data: {
                    user_id: parsedUserId,
                    balance: 0.00,
                    frozen_balance: 0.00
                }
            });

            // Create initial transaction
            await prisma.walletTransaction.create({
                data: {
                    wallet_id: wallet.id,
                    user_id: parsedUserId,
                    transaction_type: 'WALLET_SETUP',
                    amount: 0.00,
                    balance_before: 0.00,
                    balance_after: 0.00,
                    description: 'Wallet created by admin',
                    reference_type: 'ADMIN_SETUP',
                    admin_id: parseInt(session.user.id)
                }
            });
        }

        // Get recent transactions
        const recentTransactions = await prisma.walletTransaction.findMany({
            where: { user_id: parsedUserId },
            orderBy: { created_at: 'desc' },
            take: 20,
            select: {
                id: true,
                transaction_type: true,
                amount: true,
                balance_before: true,
                balance_after: true,
                description: true,
                created_at: true,
                admin_id: true
            }
        });

        console.log('Found wallet and transactions:', {
            balance: wallet.balance,
            transactions: recentTransactions.length
        });

        return NextResponse.json({
            user: user,
            wallet: {
                balance: Number(wallet.balance),
                frozen_balance: Number(wallet.frozen_balance),
                available_balance: Number(wallet.balance) - Number(wallet.frozen_balance),
                created_at: wallet.created_at,
                updated_at: wallet.updated_at
            },
            recent_transactions: recentTransactions.map(tx => ({
                id: tx.id,
                type: tx.transaction_type,
                amount: Number(tx.amount),
                balance_before: Number(tx.balance_before),
                balance_after: Number(tx.balance_after),
                description: tx.description,
                created_at: tx.created_at,
                performed_by_admin: tx.admin_id ? true : false
            }))
        });

    } catch (error) {
        console.error('Error fetching wallet details:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch wallet details',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}