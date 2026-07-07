// src/app/api/admin/commission/route.ts - FIXED FOR CURRENT SCHEMA
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { requireAdmin } from '../../../lib/auth';

// GET /api/admin/commission - Get all commission settings
export async function GET() {
    try {
        const auth = await requireAdmin();
        if ("response" in auth) return auth.response;

        // Get global setting
        const globalSetting = await prisma.commission_settings.findFirst({
            where: {
                setting_type: 'GLOBAL',
                setting_key: 'global',
                is_active: true
            }
        });

        // Get all unique rarities from cards (since there's no separate rarity table)
        console.log('Fetching rarities from cards...');
        const rarityResults = await prisma.card.groupBy({
            by: ['rarity'],
            where: {
                rarity: {
                    not: "",
                    notIn: [null as any]  // Handle null properly
                }
            },
            _count: { _all: true }  // Use _all instead of specific field
        });

        const rarities = rarityResults
            .filter(r => r.rarity && r.rarity.trim() !== '')
            .map((r, index) => ({
                id: index + 1,
                name: r.rarity!,
                symbol: null,
                color: getRarityColor(r.rarity!),
                order_index: getRarityOrder(r.rarity!),
                count: r._count._all  // Use _all count
            }))
            .sort((a, b) => a.order_index - b.order_index);

        console.log('Found rarities:', rarities.length);

        // Get rarity-specific settings
        const raritySettings = await prisma.commission_settings.findMany({
            where: {
                setting_type: 'RARITY',
                is_active: true
            }
        });

        // Create rarity settings map
        const rarityCommissionMap = raritySettings.reduce((acc: Record<string, number>, setting) => {
            acc[setting.setting_key] = Number(setting.commission_rate);
            return acc;
        }, {});

        // Get admin wallet info
        const adminWallet = await prisma.admin_wallet.findFirst({
            where: { wallet_type: 'PLATFORM' }
        });

        const response = {
            global_commission: globalSetting ? Number(globalSetting.commission_rate) : 5.00,
            rarities: rarities.map((rarity) => ({
                id: rarity.id,
                name: rarity.name,
                symbol: rarity.symbol,
                color: rarity.color,
                order_index: rarity.order_index,
                count: rarity.count,
                commission_rate: rarityCommissionMap[rarity.name] || null // null means use global
            })),
            admin_wallet: adminWallet ? {
                id: adminWallet.id,
                balance: Number(adminWallet.balance || 0),
                total_commissions: Number(adminWallet.total_commissions || 0),
                total_marketplace_sales: Number(adminWallet.total_marketplace_sales || 0)
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
        const auth = await requireAdmin();
        if ("response" in auth) return auth.response;
        const user = auth.user;

        const adminId = user.id;
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
            // Update or create global commission setting
            const existingGlobal = await tx.commission_settings.findFirst({
                where: {
                    setting_type: 'GLOBAL',
                    setting_key: 'global'
                }
            });

            if (existingGlobal) {
                await tx.commission_settings.update({
                    where: { id: existingGlobal.id },
                    data: {
                        commission_rate: global_commission,
                        created_by: adminId,
                        is_active: true,
                        updated_at: new Date()
                    }
                });
            } else {
                await tx.commission_settings.create({
                    data: {
                        setting_type: 'GLOBAL',
                        setting_key: 'global',
                        commission_rate: global_commission,
                        created_by: adminId,
                        is_active: true
                    }
                });
            }

            // Update rarity-specific commissions
            if (rarity_commissions) {
                for (const [rarityName, rate] of Object.entries(rarity_commissions)) {
                    const commissionRate = rate as number | null;

                    if (commissionRate === null || commissionRate === undefined) {
                        // Remove rarity-specific setting (use global) by setting inactive
                        await tx.commission_settings.updateMany({
                            where: {
                                setting_type: 'RARITY',
                                setting_key: rarityName
                            },
                            data: { is_active: false }
                        });
                    } else {
                        // Validate rate
                        if (typeof commissionRate !== 'number' || commissionRate < 0 || commissionRate > 50) {
                            throw new Error(`Commission rate for ${rarityName} must be between 0 and 50%`);
                        }

                        // Check if rarity-specific setting exists
                        const existingRarity = await tx.commission_settings.findFirst({
                            where: {
                                setting_type: 'RARITY',
                                setting_key: rarityName
                            }
                        });

                        if (existingRarity) {
                            // Update existing setting
                            await tx.commission_settings.update({
                                where: { id: existingRarity.id },
                                data: {
                                    commission_rate: commissionRate,
                                    created_by: adminId,
                                    is_active: true,
                                    updated_at: new Date()
                                }
                            });
                        } else {
                            // Create new setting
                            await tx.commission_settings.create({
                                data: {
                                    setting_type: 'RARITY',
                                    setting_key: rarityName,
                                    commission_rate: commissionRate,
                                    created_by: adminId,
                                    is_active: true
                                }
                            });
                        }
                    }
                }
            }

            // Ensure admin wallet exists
            const adminWallet = await tx.admin_wallet.findFirst({
                where: { wallet_type: 'PLATFORM' }
            });

            if (!adminWallet) {
                await tx.admin_wallet.create({
                    data: {
                        wallet_type: 'PLATFORM',
                        balance: 0.00,
                        total_commissions: 0.00,
                        total_marketplace_sales: 0.00
                    }
                });
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

// Helper function to get rarity color
function getRarityColor(rarity: string): string {
    switch (rarity.toLowerCase()) {
        case 'common':
            return '#6B7280'; // Gray
        case 'uncommon':
            return '#10B981'; // Green
        case 'rare':
            return '#3B82F6'; // Blue
        case 'rare holo':
        case 'holo rare':
            return '#8B5CF6'; // Purple
        case 'ultra rare':
        case 'rare ultra':
            return '#F59E0B'; // Yellow
        case 'secret rare':
        case 'rare secret':
            return '#EF4444'; // Red
        case 'promo':
            return '#EC4899'; // Pink
        default:
            return '#6B7280'; // Default gray
    }
}

// Helper function to get rarity order for sorting
function getRarityOrder(rarity: string): number {
    switch (rarity.toLowerCase()) {
        case 'common':
            return 1;
        case 'uncommon':
            return 2;
        case 'rare':
            return 3;
        case 'rare holo':
        case 'holo rare':
            return 4;
        case 'ultra rare':
        case 'rare ultra':
            return 5;
        case 'secret rare':
        case 'rare secret':
            return 6;
        case 'promo':
            return 7;
        default:
            return 999; // Unknown rarities go to end
    }
}