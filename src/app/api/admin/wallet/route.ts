// src/app/api/admin/wallet/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '../../../lib/prisma';

// POST /api/admin/wallet - Admin wallet operations
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        const { user_id, operation, amount, description } = body;

        console.log('Wallet operation request:', { user_id, operation, amount });

        if (!user_id || !operation || !amount || amount <= 0) {
            return NextResponse.json({
                error: 'user_id, operation, and positive amount are required'
            }, { status: 400 });
        }

        const adminId = parseInt(session.user.id);
        const targetUserId = parseInt(user_id);
        const operationAmount = Number(amount);

        // Validate operation type
        const validOperations = ['ADD_MONEY', 'DEDUCT_MONEY', 'FREEZE_FUNDS', 'UNFREEZE_FUNDS'];
        if (!validOperations.includes(operation)) {
            return NextResponse.json({
                error: 'Invalid operation. Must be ADD_MONEY, DEDUCT_MONEY, FREEZE_FUNDS, or UNFREEZE_FUNDS'
            }, { status: 400 });
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
        let transactionType = operation;

        console.log('Current wallet state:', { currentBalance, currentFrozen });

        // Perform operation
        switch (operation) {
            case 'ADD_MONEY':
                newBalance = currentBalance + operationAmount;
                break;

            case 'DEDUCT_MONEY':
                if (currentBalance < operationAmount) {
                    return NextResponse.json({
                        error: 'Insufficient balance for deduction'
                    }, { status: 400 });
                }
                newBalance = currentBalance - operationAmount;
                break;

            case 'FREEZE_FUNDS':
                const availableBalance = currentBalance - currentFrozen;
                if (availableBalance < operationAmount) {
                    return NextResponse.json({
                        error: 'Insufficient available balance to freeze'
                    }, { status: 400 });
                }
                newFrozenBalance = currentFrozen + operationAmount;
                break;

            case 'UNFREEZE_FUNDS':
                if (currentFrozen < operationAmount) {
                    return NextResponse.json({
                        error: 'Insufficient frozen balance to unfreeze'
                    }, { status: 400 });
                }
                newFrozenBalance = currentFrozen - operationAmount;
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
                    user_id: targetUserId,
                    transaction_type: transactionType,
                    amount: operation === 'DEDUCT_MONEY' ? -operationAmount : operationAmount,
                    balance_before: currentBalance,
                    balance_after: newBalance,
                    description: description || `Admin ${operation.toLowerCase().replace('_', ' ')}: $${operationAmount}`,
                    reference_type: 'ADMIN_OPERATION',
                    admin_id: adminId
                }
            });

            return { wallet: updatedWallet, transaction: walletTransaction };
        });

        // Get user info for response
        const user = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { name: true, email: true }
        });

        console.log('Wallet operation completed successfully');

        return NextResponse.json({
            success: true,
            operation,
            amount: operationAmount,
            user: user,
            wallet: {
                balance: Number(result.wallet.balance),
                frozen_balance: Number(result.wallet.frozen_balance),
                available_balance: Number(result.wallet.balance) - Number(result.wallet.frozen_balance)
            },
            transaction_id: result.transaction.id
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

        console.log('Fetching wallet data for user:', userId);

        if (!userId) {
            return NextResponse.json({ error: 'user_id parameter required' }, { status: 400 });
        }

        const wallet = await prisma.userWallet.findUnique({
            where: { user_id: parseInt(userId) },
            include: {
                user: {
                    select: { id: true, name: true, email: true }
                }
            }
        });

        if (!wallet) {
            console.log('Wallet not found, creating new one');
            // Create wallet if it doesn't exist
            const newWallet = await prisma.userWallet.create({
                data: {
                    user_id: parseInt(userId),
                    balance: 0.00,
                    frozen_balance: 0.00
                },
                include: {
                    user: {
                        select: { id: true, name: true, email: true }
                    }
                }
            });

            // Create initial transaction
            await prisma.walletTransaction.create({
                data: {
                    user_id: parseInt(userId),
                    transaction_type: 'WALLET_SETUP',
                    amount: 0.00,
                    balance_before: 0.00,
                    balance_after: 0.00,
                    description: 'Wallet created automatically',
                    reference_type: 'SYSTEM_SETUP'
                }
            });

            return NextResponse.json({
                user: newWallet.user,
                wallet: {
                    balance: 0,
                    frozen_balance: 0,
                    available_balance: 0,
                    created_at: newWallet.created_at,
                    updated_at: newWallet.updated_at
                },
                recent_transactions: []
            });
        }

        // Get recent transactions
        const recentTransactions = await prisma.walletTransaction.findMany({
            where: { user_id: parseInt(userId) },
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
            user: wallet.user,
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