// src/app/api/admin/commission/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '../../../lib/prisma';

// GET /api/admin/commission - Get all commission settings
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Get global setting
        const globalSetting = await prisma.$queryRaw`
      SELECT * FROM commission_settings 
      WHERE setting_type = 'GLOBAL' AND setting_key = 'global' AND is_active = TRUE
      LIMIT 1
    ` as any[];

        // Get all rarities from the database
        console.log('Fetching rarities from database...');
        const rarities = await prisma.rarity.findMany({
            where: { is_active: true },
            orderBy: { order_index: 'asc' }
        });
        console.log('Found rarities:', rarities.length);

        // Get rarity-specific settings
        const raritySettings = await prisma.$queryRaw`
      SELECT * FROM commission_settings 
      WHERE setting_type = 'RARITY' AND is_active = TRUE
    ` as any[];

        // Create rarity settings map
        const rarityCommissionMap = raritySettings.reduce((acc: any, setting: any) => {
            acc[setting.setting_key] = Number(setting.commission_rate);
            return acc;
        }, {});

        // Get admin wallet info
        const adminWallet = await prisma.$queryRaw`
      SELECT * FROM admin_wallet WHERE wallet_type = 'PLATFORM' LIMIT 1
    ` as any[];

        const response = {
            global_commission: globalSetting.length > 0 ? Number(globalSetting[0].commission_rate) : 5.00,
            rarities: rarities.map(rarity => ({
                id: rarity.id,
                name: rarity.name,
                symbol: rarity.symbol,
                color: rarity.color,
                order_index: rarity.order_index,
                commission_rate: rarityCommissionMap[rarity.name] || null // null means use global
            })),
            admin_wallet: adminWallet.length > 0 ? {
                id: adminWallet[0].id,
                balance: Number(adminWallet[0].balance),
                total_commissions: Number(adminWallet[0].total_commissions),
                total_marketplace_sales: Number(adminWallet[0].total_marketplace_sales)
            } : null
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('Error fetching commission settings:', error);
        return NextResponse.json(
            { error: 'Failed to fetch commission settings' },
            { status: 500 }
        );
    }
}

// POST /api/admin/commission - Update commission settings
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const adminId = parseInt(session.user.id);
        const body = await request.json();
        const { global_commission, rarity_commissions } = body;

        // Validate global commission
        if (typeof global_commission !== 'number' || global_commission < 0 || global_commission > 50) {
            return NextResponse.json(
                { error: 'Global commission must be between 0 and 50%' },
                { status: 400 }
            );
        }

        // Validate rarity commissions
        if (rarity_commissions && typeof rarity_commissions !== 'object') {
            return NextResponse.json(
                { error: 'Rarity commissions must be an object' },
                { status: 400 }
            );
        }

        await prisma.$transaction(async (tx) => {
            // Update global commission
            await tx.$executeRaw`
        INSERT INTO commission_settings (setting_type, setting_key, commission_rate, created_by, is_active)
        VALUES ('GLOBAL', 'global', ${global_commission}, ${adminId}, TRUE)
        ON DUPLICATE KEY UPDATE 
        commission_rate = ${global_commission},
        created_by = ${adminId},
        updated_at = CURRENT_TIMESTAMP
      `;

            // Update rarity-specific commissions
            if (rarity_commissions) {
                for (const [rarityName, rate] of Object.entries(rarity_commissions)) {
                    const commissionRate = rate as number;

                    if (commissionRate === null || commissionRate === undefined) {
                        // Remove rarity-specific setting (use global)
                        await tx.$executeRaw`
              UPDATE commission_settings 
              SET is_active = FALSE 
              WHERE setting_type = 'RARITY' AND setting_key = ${rarityName}
            `;
                    } else {
                        // Validate rate
                        if (typeof commissionRate !== 'number' || commissionRate < 0 || commissionRate > 50) {
                            throw new Error(`Commission rate for ${rarityName} must be between 0 and 50%`);
                        }

                        // Insert or update rarity-specific setting
                        await tx.$executeRaw`
              INSERT INTO commission_settings (setting_type, setting_key, commission_rate, created_by, is_active)
              VALUES ('RARITY', ${rarityName}, ${commissionRate}, ${adminId}, TRUE)
              ON DUPLICATE KEY UPDATE 
              commission_rate = ${commissionRate},
              created_by = ${adminId},
              is_active = TRUE,
              updated_at = CURRENT_TIMESTAMP
            `;
                    }
                }
            }

            // Ensure admin wallet exists
            const adminWalletExists = await tx.$queryRaw`
        SELECT id FROM admin_wallet WHERE wallet_type = 'PLATFORM' LIMIT 1
      ` as any[];

            if (adminWalletExists.length === 0) {
                await tx.$executeRaw`
          INSERT INTO admin_wallet (wallet_type, balance, total_commissions, total_marketplace_sales)
          VALUES ('PLATFORM', 0.00, 0.00, 0.00)
        `;
            }
        });

        return NextResponse.json({
            success: true,
            message: 'Commission settings updated successfully'
        });

    } catch (error) {
        console.error('Error updating commission settings:', error);
        return NextResponse.json(
            {
                error: 'Failed to update commission settings',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}