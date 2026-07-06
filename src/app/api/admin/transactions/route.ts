// src/app/api/admin/transactions/route.ts - Updated version
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { requireAdmin } from '../../../lib/auth';

export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdmin();
        if ("response" in auth) return auth.response;

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const limit = parseInt(searchParams.get('limit') || '50');

        let where: any = {};

        if (status) {
            where.status = status;
        }

        // Get current date info for monthly calculations
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Get aggregated statistics
        const [
            totalSalesCount,
            pendingTransactionsCount,
            monthlyTransactions,
            transactions
        ] = await Promise.all([
            // Total completed sales
            prisma.transaction.count({
                where: { status: 'COMPLETED' }
            }),
            // Pending transactions
            prisma.transaction.count({
                where: {
                    status: {
                        in: ['PENDING_BUYER_CONFIRMATION', 'PENDING_SELLER_CONFIRMATION']
                    }
                }
            }),
            // Monthly revenue calculation
            prisma.transaction.findMany({
                where: {
                    status: 'COMPLETED',
                    created_at: { gte: startOfMonth }
                },
                select: { amount: true }
            }),
            // Recent transactions
            prisma.transaction.findMany({
                where,
                orderBy: { created_at: 'desc' },
                take: limit
            })
        ]);

        // Calculate monthly revenue
        const monthlyRevenue = monthlyTransactions.reduce((sum, t) => {
            return sum + Number(t.amount);
        }, 0);

        // Get related data for transactions (same as before)
        const transactionsWithDetails = await Promise.all(
            transactions.map(async (transaction) => {
                const userCard = await prisma.userCard.findUnique({
                    where: { id: transaction.user_card_id }
                });

                const card = userCard ? await prisma.card.findUnique({
                    where: { id: userCard.card_id },
                    select: {
                        id: true,
                        name: true,
                        set_name: true,
                        image_url: true
                    }
                }) : null;

                const buyer = await prisma.user.findUnique({
                    where: { id: transaction.buyer_id },
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                });

                const seller = await prisma.user.findUnique({
                    where: { id: transaction.seller_id },
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                });

                const expiresAt = transaction.status === 'PENDING_BUYER_CONFIRMATION'
                    ? new Date(new Date(transaction.created_at).getTime() + 24 * 60 * 60 * 1000)
                    : null;

                return {
                    ...transaction,
                    userCard: userCard ? {
                        ...userCard,
                        card: card
                    } : null,
                    buyer,
                    seller,
                    expires_at: expiresAt?.toISOString(),
                    is_expired: expiresAt ? new Date() > expiresAt : false
                };
            })
        );

        return NextResponse.json({
            transactions: transactionsWithDetails,
            total: transactions.length,
            totalSales: totalSalesCount,
            pendingTransactions: pendingTransactionsCount,
            monthlyRevenue: monthlyRevenue
        });

    } catch (error) {
        console.error('Error fetching admin transactions:', error);
        return NextResponse.json(
            { error: 'Failed to fetch transactions' },
            { status: 500 }
        );
    }
}