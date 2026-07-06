// src/app/api/admin/commission/wallet/adjust/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { requireAdmin } from '../../../../../lib/auth';

// POST /api/admin/commission/wallet/adjust - Manual wallet adjustment
export async function POST(request: NextRequest) {
    try {
        const auth = await requireAdmin();
        if ("response" in auth) return auth.response;
        const user = auth.user;

    const adminId = user.id;
    const body = await request.json();
    const { amount, description } = body;

    // Validate input
    if (typeof amount !== 'number' || isNaN(amount) || amount === 0) {
        return NextResponse.json(
            { error: 'Valid amount is required' },
            { status: 400 }
        );
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
        return NextResponse.json(
            { error: 'Description is required' },
            { status: 400 }
        );
    }

    await prisma.$transaction(async (tx) => {
        // Get admin wallet
        const adminWallet = await tx.$queryRaw`
            SELECT * FROM admin_wallet WHERE wallet_type = 'PLATFORM' LIMIT 1
        ` as any[];

        if (adminWallet.length === 0) {
            throw new Error('Admin wallet not found');
        }

        const wallet = adminWallet[0];
        const currentBalance = Number(wallet.balance);
        const newBalance = currentBalance + amount;

        // Prevent negative balance for withdrawals
        if (newBalance < 0) {
            throw new Error(`Insufficient funds. Current balance: ${currentBalance.toFixed(2)}, Requested: ${Math.abs(amount).toFixed(2)}`);
        }

        // Update admin wallet balance
        await tx.$executeRaw`
            UPDATE admin_wallet 
            SET balance = ${newBalance},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${wallet.id}
        `;

        // Record the adjustment transaction
        await tx.$executeRaw`
            INSERT INTO admin_wallet_transactions 
            (admin_wallet_id, transaction_type, amount, balance_before, balance_after, description, 
            reference_type, admin_id)
            VALUES (${wallet.id}, 'ADJUSTMENT', ${amount}, ${currentBalance}, ${newBalance}, 
                    ${description.trim()}, 'MANUAL_ADJUSTMENT', ${adminId})
        `;
    });

        return NextResponse.json({
            success: true,
            message: amount > 0 ? 'Funds added successfully' : 'Funds removed successfully'
        });
        } catch (error: any) {
            return NextResponse.json(
                { error: error.message || 'Internal server error' },
                { status: 500 }
            );
        }
    }