// src/app/api/admin/commission/wallet/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requireAdmin } from '../../../../lib/auth';

// GET /api/admin/commission/wallet - Get admin wallet data and transactions
export async function GET() {
    try {
        const auth = await requireAdmin();
        if ("response" in auth) return auth.response;

        // Get admin wallet
        const adminWallet = await prisma.$queryRaw`
      SELECT * FROM admin_wallet WHERE wallet_type = 'PLATFORM' LIMIT 1
    ` as any[];

        if (adminWallet.length === 0) {
            // Create admin wallet if it doesn't exist
            await prisma.$executeRaw`
        INSERT INTO admin_wallet (wallet_type, balance, total_commissions, total_marketplace_sales)
        VALUES ('PLATFORM', 0.00, 0.00, 0.00)
      `;

            const newWallet = await prisma.$queryRaw`
        SELECT * FROM admin_wallet WHERE wallet_type = 'PLATFORM' LIMIT 1
      ` as any[];

            return NextResponse.json({
                admin_wallet: newWallet[0],
                recent_transactions: [],
                stats: {
                    total_transactions: 0,
                    monthly_commissions: 0,
                    monthly_marketplace_sales: 0,
                    daily_average: 0
                }
            });
        }

        const wallet = adminWallet[0];

        // Get recent transactions (last 50)
        const recentTransactions = await prisma.$queryRaw`
      SELECT * FROM admin_wallet_transactions 
      WHERE admin_wallet_id = ${wallet.id}
      ORDER BY created_at DESC 
      LIMIT 50
    ` as any[];

        // Get statistics
        const currentMonth = new Date();
        const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);

        // Monthly commissions
        const monthlyCommissions = await prisma.$queryRaw`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM admin_wallet_transactions 
      WHERE admin_wallet_id = ${wallet.id}
      AND transaction_type = 'COMMISSION'
      AND created_at >= ${firstDayOfMonth}
    ` as any[];

        // Monthly marketplace sales
        const monthlyMarketplaceSales = await prisma.$queryRaw`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM admin_wallet_transactions 
      WHERE admin_wallet_id = ${wallet.id}
      AND transaction_type = 'MARKETPLACE_SALE'
      AND created_at >= ${firstDayOfMonth}
    ` as any[];

        // Total transaction count
        const totalTransactions = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM admin_wallet_transactions 
      WHERE admin_wallet_id = ${wallet.id}
    ` as any[];

        // Calculate daily average for this month
        const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
        const currentDay = currentMonth.getDate();
        const monthlyTotal = Number(monthlyCommissions[0].total) + Number(monthlyMarketplaceSales[0].total);
        const dailyAverage = currentDay > 0 ? monthlyTotal / currentDay : 0;

        const response = {
            admin_wallet: {
                id: wallet.id,
                balance: Number(wallet.balance),
                total_commissions: Number(wallet.total_commissions),
                total_marketplace_sales: Number(wallet.total_marketplace_sales),
                created_at: wallet.created_at,
                updated_at: wallet.updated_at
            },
            recent_transactions: recentTransactions.map(tx => ({
                id: tx.id,
                transaction_type: tx.transaction_type,
                amount: Number(tx.amount),
                balance_before: Number(tx.balance_before),
                balance_after: Number(tx.balance_after),
                description: tx.description,
                reference_type: tx.reference_type,
                reference_id: tx.reference_id,
                commission_rate: tx.commission_rate ? Number(tx.commission_rate) : null,
                created_at: tx.created_at
            })),
            stats: {
                total_transactions: Number(totalTransactions[0].count),
                monthly_commissions: Number(monthlyCommissions[0].total),
                monthly_marketplace_sales: Number(monthlyMarketplaceSales[0].total),
                daily_average: dailyAverage
            }
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('Error fetching admin wallet data:', error);
        return NextResponse.json(
            { error: 'Failed to fetch admin wallet data' },
            { status: 500 }
        );
    }
}