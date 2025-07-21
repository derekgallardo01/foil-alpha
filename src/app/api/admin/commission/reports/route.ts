// src/app/api/admin/commission/reports/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { prisma } from '../../../../lib/prisma';

// GET /api/admin/commission/reports - Get commission reports and analytics
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get('days') || '30');
        const reportType = searchParams.get('type') || 'overview';

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));

        console.log('Generating commission report for:', { days, startDate, endDate, reportType });

        // Get commission by rarity
        const commissionByRarity = await prisma.$queryRaw`
      SELECT 
        c.rarity,
        SUM(awt.amount) as total_commission,
        COUNT(*) as transaction_count,
        AVG(awt.commission_rate) as avg_commission_rate
      FROM admin_wallet_transactions awt
      LEFT JOIN user_cards uc ON awt.user_card_id = uc.id
      LEFT JOIN cards c ON uc.card_id = c.id
      WHERE awt.transaction_type = 'COMMISSION'
      AND awt.created_at >= ${startDate}
      AND awt.created_at <= ${endDate}
      AND c.rarity IS NOT NULL
      GROUP BY c.rarity
      ORDER BY total_commission DESC
    ` as any[];

        // Get monthly breakdown
        const monthlyBreakdown = await prisma.$queryRaw`
      SELECT 
        DATE_FORMAT(awt.created_at, '%Y-%m') as month,
        SUM(CASE WHEN awt.transaction_type = 'COMMISSION' THEN awt.amount ELSE 0 END) as commissions,
        SUM(CASE WHEN awt.transaction_type = 'MARKETPLACE_SALE' THEN awt.amount ELSE 0 END) as marketplace_sales,
        SUM(awt.amount) as total_revenue,
        COUNT(*) as transaction_count
      FROM admin_wallet_transactions awt
      WHERE awt.created_at >= ${startDate}
      AND awt.created_at <= ${endDate}
      AND awt.transaction_type IN ('COMMISSION', 'MARKETPLACE_SALE')
      GROUP BY DATE_FORMAT(awt.created_at, '%Y-%m')
      ORDER BY month DESC
      LIMIT 12
    ` as any[];

        // Get top performing cards
        const topCards = await prisma.$queryRaw`
      SELECT 
        c.name as card_name,
        SUM(awt.amount) as total_commission,
        COUNT(*) as transaction_count,
        AVG(
          CASE 
            WHEN awt.user_card_id IS NOT NULL THEN uc.fixed_price
            WHEN awt.card_id IS NOT NULL THEN c.market_price
            ELSE 0
          END
        ) as avg_price
      FROM admin_wallet_transactions awt
      LEFT JOIN user_cards uc ON awt.user_card_id = uc.id
      LEFT JOIN cards c ON (uc.card_id = c.id OR awt.card_id = c.id)
      WHERE awt.transaction_type IN ('COMMISSION', 'MARKETPLACE_SALE')
      AND awt.created_at >= ${startDate}
      AND awt.created_at <= ${endDate}
      AND c.name IS NOT NULL
      GROUP BY c.id, c.name
      ORDER BY total_commission DESC
      LIMIT 20
    ` as any[];

        // Get summary statistics
        const summary = await prisma.$queryRaw`
      SELECT 
        SUM(awt.amount) as total_revenue,
        SUM(CASE WHEN awt.transaction_type = 'COMMISSION' THEN awt.amount ELSE 0 END) as total_commissions,
        SUM(CASE WHEN awt.transaction_type = 'MARKETPLACE_SALE' THEN awt.amount ELSE 0 END) as total_marketplace_sales,
        AVG(CASE WHEN awt.commission_rate IS NOT NULL THEN awt.commission_rate ELSE 0 END) as avg_commission_rate,
        COUNT(*) as total_transactions
      FROM admin_wallet_transactions awt
      WHERE awt.created_at >= ${startDate}
      AND awt.created_at <= ${endDate}
      AND awt.transaction_type IN ('COMMISSION', 'MARKETPLACE_SALE')
    ` as any[];

        const reportData = {
            commission_by_rarity: commissionByRarity.map(item => ({
                rarity: item.rarity || 'Unknown',
                total_commission: Number(item.total_commission || 0),
                transaction_count: Number(item.transaction_count || 0),
                avg_commission_rate: Number(item.avg_commission_rate || 0)
            })),
            monthly_breakdown: monthlyBreakdown.map(item => ({
                month: item.month,
                commissions: Number(item.commissions || 0),
                marketplace_sales: Number(item.marketplace_sales || 0),
                total_revenue: Number(item.total_revenue || 0),
                transaction_count: Number(item.transaction_count || 0)
            })),
            top_cards: topCards.map(item => ({
                card_name: item.card_name || 'Unknown Card',
                total_commission: Number(item.total_commission || 0),
                transaction_count: Number(item.transaction_count || 0),
                avg_price: Number(item.avg_price || 0)
            })),
            summary: {
                total_revenue: Number(summary[0]?.total_revenue || 0),
                total_commissions: Number(summary[0]?.total_commissions || 0),
                total_marketplace_sales: Number(summary[0]?.total_marketplace_sales || 0),
                avg_commission_rate: Number(summary[0]?.avg_commission_rate || 0),
                total_transactions: Number(summary[0]?.total_transactions || 0)
            }
        };

        console.log('Commission report generated:', {
            rarities: reportData.commission_by_rarity.length,
            months: reportData.monthly_breakdown.length,
            topCards: reportData.top_cards.length,
            totalRevenue: reportData.summary.total_revenue
        });

        return NextResponse.json(reportData);

    } catch (error) {
        console.error('Error generating commission report:', error);
        return NextResponse.json(
            {
                error: 'Failed to generate commission report',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}