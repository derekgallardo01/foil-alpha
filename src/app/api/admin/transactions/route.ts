// src/app/api/admin/transactions/route.ts - Get transactions for admin
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '../../../lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const limit = parseInt(searchParams.get('limit') || '50');

        let where: any = {};

        if (status) {
            where.status = status;
        }

        // Get transactions without problematic includes
        const transactions = await prisma.transaction.findMany({
            where,
            orderBy: { created_at: 'desc' },
            take: limit
        });

        // Get related data separately for each transaction
        const transactionsWithDetails = await Promise.all(
            transactions.map(async (transaction) => {
                // Get user card details
                const userCard = await prisma.userCard.findUnique({
                    where: { id: transaction.user_card_id }
                });

                // Get card details
                const card = userCard ? await prisma.card.findUnique({
                    where: { id: userCard.card_id },
                    select: {
                        id: true,
                        name: true,
                        set_name: true,
                        image_url: true
                    }
                }) : null;

                // Get buyer details
                const buyer = await prisma.user.findUnique({
                    where: { id: transaction.buyer_id },
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                });

                // Get seller details
                const seller = await prisma.user.findUnique({
                    where: { id: transaction.seller_id },
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                });

                // Calculate expiration info for pending confirmations
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
            total: transactions.length
        });

    } catch (error) {
        console.error('Error fetching admin transactions:', error);
        return NextResponse.json(
            { error: 'Failed to fetch transactions' },
            { status: 500 }
        );
    }
}