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

        const transactions = await prisma.transaction.findMany({
            where,
            include: {
                userCard: {
                    include: {
                        card: {
                            select: {
                                id: true,
                                name: true,
                                set_name: true,
                                image_url: true
                            }
                        }
                    }
                },
                buyer: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                seller: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            },
            orderBy: { created_at: 'desc' },
            take: limit
        });

        // Add expiration info for pending confirmations
        const transactionsWithExpiry = transactions.map(transaction => {
            const expiresAt = transaction.status === 'PENDING_BUYER_CONFIRMATION'
                ? new Date(new Date(transaction.created_at).getTime() + 24 * 60 * 60 * 1000)
                : null;

            return {
                ...transaction,
                expires_at: expiresAt?.toISOString(),
                is_expired: expiresAt ? new Date() > expiresAt : false
            };
        });

        return NextResponse.json({
            transactions: transactionsWithExpiry,
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