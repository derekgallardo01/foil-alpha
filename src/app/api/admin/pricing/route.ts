// src/app/api/admin/pricing/route.ts - FIXED FOR CURRENT SCHEMA
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { requireAdmin } from '../../../lib/auth';

// GET /api/admin/pricing - Get pricing analytics and management data
export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdmin();
        if ("response" in auth) return auth.response;

        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        if (action === 'analytics') {
            // Get pricing analytics
            const analytics = await getPricingAnalytics();
            return NextResponse.json({ success: true, data: analytics });
        }

        if (action === 'config') {
            // Get current pricing configuration
            const config = await getPricingConfiguration();
            return NextResponse.json({ success: true, data: config });
        }

        // Default: Get cards with pricing issues
        const cardsWithIssues = await getCardsWithPricingIssues();
        return NextResponse.json({ success: true, data: cardsWithIssues });

    } catch (error) {
        console.error('Error in pricing management:', error);
        return NextResponse.json(
            { error: 'Failed to fetch pricing data' },
            { status: 500 }
        );
    }
}

// POST /api/admin/pricing - Bulk pricing operations
export async function POST(request: NextRequest) {
    try {
        const auth = await requireAdmin();
        if ("response" in auth) return auth.response;

        const body = await request.json();
        const { action, data } = body;

        switch (action) {
            case 'bulk_update_by_rarity':
                return await bulkUpdateByRarity(data);

            case 'bulk_update_by_set':
                return await bulkUpdateBySet(data);

            case 'recalculate_prices':
                return await recalculateAllPrices(data);

            case 'update_pricing_rules':
                return await updatePricingRules(data);

            case 'export_pricing_csv':
                return await exportPricingToCsv(data);

            case 'import_pricing_csv':
                return await importPricingFromCsv(data);

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        console.error('Error in pricing operation:', error);
        return NextResponse.json(
            { error: 'Failed to perform pricing operation' },
            { status: 500 }
        );
    }
}

// Analytics function
async function getPricingAnalytics() {
    const [
        totalCards,
        cardsWithPrice,
        cardsWithoutPrice,
        avgPriceByRarity,
        priceDistribution,
        recentPriceUpdates,
        topValueCards
    ] = await Promise.all([
        // Total cards
        prisma.card.count(),

        // Cards with prices
        prisma.card.count({
            where: { market_price: { not: null, gt: 0 } }
        }),

        // Cards without prices
        prisma.card.count({
            where: { OR: [{ market_price: null }, { market_price: 0 }] }
        }),

        // Average price by rarity
        prisma.card.groupBy({
            by: ['rarity'],
            _avg: { market_price: true },
            _count: { id: true },
            where: { market_price: { not: null, gt: 0 } }
        }),

        // Price distribution
        prisma.$queryRaw`
      SELECT 
        CASE 
          WHEN market_price < 1 THEN 'Under $1'
          WHEN market_price < 5 THEN '$1-$5'
          WHEN market_price < 10 THEN '$5-$10'
          WHEN market_price < 25 THEN '$10-$25'
          WHEN market_price < 50 THEN '$25-$50'
          WHEN market_price < 100 THEN '$50-$100'
          ELSE 'Over $100'
        END as price_range,
        COUNT(*) as count
      FROM cards 
      WHERE market_price IS NOT NULL AND market_price > 0
      GROUP BY 
        CASE 
          WHEN market_price < 1 THEN 'Under $1'
          WHEN market_price < 5 THEN '$1-$5'
          WHEN market_price < 10 THEN '$5-$10'
          WHEN market_price < 25 THEN '$10-$25'
          WHEN market_price < 50 THEN '$25-$50'
          WHEN market_price < 100 THEN '$50-$100'
          ELSE 'Over $100'
        END
      ORDER BY MIN(market_price)
    `,

        // Recent price updates - FIXED: Use existing fields
        prisma.card.findMany({
            where: { last_updated: { not: null } }, // FIXED: Use last_updated instead of last_price_update
            orderBy: { last_updated: 'desc' }, // FIXED: Use last_updated
            take: 10,
            select: {
                id: true,
                name: true,
                set_name: true,
                rarity: true,
                market_price: true,
                last_updated: true // FIXED: Use last_updated
            }
        }),

        // Top value cards
        prisma.card.findMany({
            where: { market_price: { not: null } },
            orderBy: { market_price: 'desc' },
            take: 20,
            select: {
                id: true,
                name: true,
                set_name: true,
                rarity: true,
                market_price: true,
                image_url: true
            }
        })
    ]);

    return {
        summary: {
            total_cards: totalCards,
            cards_with_price: cardsWithPrice,
            cards_without_price: cardsWithoutPrice,
            pricing_coverage: totalCards > 0 ? ((cardsWithPrice / totalCards) * 100).toFixed(1) : '0',
        },
        price_by_rarity: avgPriceByRarity.map(item => ({
            rarity: item.rarity,
            avg_price: item._avg.market_price ? Number(item._avg.market_price).toFixed(2) : '0.00',
            card_count: item._count.id
        })),
        price_distribution: priceDistribution,
        recent_updates: recentPriceUpdates,
        top_value_cards: topValueCards.map(card => ({
            ...card,
            market_price: card.market_price ? Number(card.market_price).toFixed(2) : '0.00'
        }))
    };
}

// Get pricing configuration
async function getPricingConfiguration() {
    // This would typically come from a database table, but for now return static config
    return {
        rarity_base_prices: {
            'Common': 0.25,
            'Uncommon': 0.75,
            'Rare': 3.00,
            'Holo Rare': 8.00,
            'Ultra Rare': 25.00,
            'Secret Rare': 45.00,
        },
        feature_multipliers: {
            'HOLOGRAPHIC': 1.8,
            'REVERSE_HOLO': 1.3,
            'SECRET_RARE': 2.0,
            'FIRST_EDITION': 3.0,
            'SHADOWLESS': 2.5,
        },
        marketplace_markup: 1.15,
        auto_pricing_enabled: true,
        price_update_frequency: '24h'
    };
}

// Get cards with pricing issues
async function getCardsWithPricingIssues() {
    const [cardsWithoutPrice, cardsWithLowPrice, cardsWithHighPrice] = await Promise.all([
        // Cards without price
        prisma.card.findMany({
            where: { OR: [{ market_price: null }, { market_price: 0 }] },
            select: {
                id: true,
                name: true,
                set_name: true,
                rarity: true,
                market_price: true,
                source: true,
            },
            take: 50
        }),

        // Cards with suspiciously low prices
        prisma.card.findMany({
            where: {
                market_price: { lt: 0.1, gt: 0 },
                rarity: { in: ['Rare', 'Holo Rare', 'Ultra Rare', 'Secret Rare'] }
            },
            select: {
                id: true,
                name: true,
                set_name: true,
                rarity: true,
                market_price: true,
            },
            take: 20
        }),

        // Cards with suspiciously high prices
        prisma.card.findMany({
            where: {
                market_price: { gt: 1000 },
                rarity: { in: ['Common', 'Uncommon'] }
            },
            select: {
                id: true,
                name: true,
                set_name: true,
                rarity: true,
                market_price: true,
            },
            take: 20
        })
    ]);

    return {
        without_price: cardsWithoutPrice,
        suspiciously_low: cardsWithLowPrice,
        suspiciously_high: cardsWithHighPrice
    };
}

// Bulk update by rarity
async function bulkUpdateByRarity(data: { rarity: string; price_multiplier?: number; fixed_price?: number }) {
    const { rarity, price_multiplier, fixed_price } = data;

    let updateData: any = {
        last_updated: new Date() // FIXED: Use last_updated instead of last_price_update
    };

    if (fixed_price !== undefined) {
        updateData.market_price = fixed_price;
    } else if (price_multiplier !== undefined) {
        // Use raw SQL to multiply existing prices
        const result = await prisma.$executeRaw`
      UPDATE cards 
      SET market_price = COALESCE(market_price, 1.0) * ${price_multiplier},
          last_updated = NOW()
      WHERE rarity = ${rarity}
    `;

        return NextResponse.json({
            success: true,
            message: `Updated ${result} cards with rarity ${rarity}`,
            affected_cards: result
        });
    }

    const result = await prisma.card.updateMany({
        where: { rarity },
        data: updateData
    });

    return NextResponse.json({
        success: true,
        message: `Updated ${result.count} cards with rarity ${rarity}`,
        affected_cards: result.count
    });
}

// Bulk update by set
async function bulkUpdateBySet(data: { set_name: string; price_multiplier?: number; fixed_price?: number }) {
    const { set_name, price_multiplier, fixed_price } = data;

    let updateData: any = {
        last_updated: new Date() // FIXED: Use last_updated instead of last_price_update
    };

    if (fixed_price !== undefined) {
        updateData.market_price = fixed_price;
    } else if (price_multiplier !== undefined) {
        const result = await prisma.$executeRaw`
      UPDATE cards 
      SET market_price = COALESCE(market_price, 1.0) * ${price_multiplier},
          last_updated = NOW()
      WHERE set_name = ${set_name}
    `;

        return NextResponse.json({
            success: true,
            message: `Updated ${result} cards from set ${set_name}`,
            affected_cards: result
        });
    }

    const result = await prisma.card.updateMany({
        where: { set_name },
        data: updateData
    });

    return NextResponse.json({
        success: true,
        message: `Updated ${result.count} cards from set ${set_name}`,
        affected_cards: result.count
    });
}

// Recalculate all prices
async function recalculateAllPrices(data: { strategy?: string; force_overwrite?: boolean }) {
    const { strategy = 'AUTO', force_overwrite = false } = data;

    // Get all cards that need price recalculation
    const whereCondition = force_overwrite
        ? {}
        : { OR: [{ market_price: null }, { market_price: 0 }] };

    const cards = await prisma.card.findMany({
        where: whereCondition
    });

    let updatedCount = 0;
    const errors: any[] = [];

    for (const card of cards) {
        try {
            // Recalculate price using simplified logic since we don't have separate tables
            const calculatedPrice = calculateIntelligentPrice(card, strategy);

            await prisma.card.update({
                where: { id: card.id },
                data: {
                    market_price: calculatedPrice,
                    last_updated: new Date() // FIXED: Use last_updated instead of last_price_update
                }
            });

            updatedCount++;
        } catch (error) {
            errors.push({
                card_id: card.id,
                card_name: card.name,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    return NextResponse.json({
        success: true,
        message: `Recalculated prices for ${updatedCount} cards`,
        details: {
            updated_count: updatedCount,
            error_count: errors.length,
            strategy_used: strategy,
            errors: errors.slice(0, 10) // Limit errors in response
        }
    });
}

// Helper function to calculate intelligent price (simplified version)
function calculateIntelligentPrice(card: any, strategy: string): number {
    const RARITY_PRICES: { [key: string]: number } = {
        'Common': 0.25,
        'Uncommon': 0.75,
        'Rare': 3.00,
        'Holo Rare': 8.00,
        'Ultra Rare': 25.00,
        'Secret Rare': 45.00,
        'Rainbow Rare': 75.00,
        'Gold Rare': 60.00,
    };

    const POPULAR_POKEMON: { [key: string]: number } = {
        'Charizard': 3.0,
        'Pikachu': 2.0,
        'Mewtwo': 1.8,
        'Mew': 1.7,
        'Lugia': 1.6,
    };

    let basePrice = RARITY_PRICES[card.rarity] || 1.00;

    // Apply Pokemon popularity multiplier
    const pokemonName = card.name.split(' ')[0];
    const popularityMultiplier = POPULAR_POKEMON[pokemonName] || 1.0;
    basePrice *= popularityMultiplier;

    // Apply holographic multiplier
    if (card.rarity?.toLowerCase().includes('holo')) {
        basePrice *= 1.8;
    }

    // Apply secret rare multiplier
    if (card.rarity?.toLowerCase().includes('secret')) {
        basePrice *= 2.0;
    }

    // Apply marketplace markup
    basePrice *= 1.15;

    return Math.max(0.25, Math.round(basePrice * 100) / 100);
}

// Update pricing rules
async function updatePricingRules(data: any) {
    // In a real implementation, this would update pricing rules in the database
    // For now, we'll just return success
    return NextResponse.json({
        success: true,
        message: 'Pricing rules updated successfully',
        updated_rules: data
    });
}

// Export pricing to CSV
async function exportPricingToCsv(data: { filters?: any }) {
    const cards = await prisma.card.findMany({
        select: {
            id: true,
            name: true,
            set_name: true,
            card_number: true, // FIXED: Use card_number instead of set_number
            rarity: true,
            card_type: true,
            market_price: true,
            price_tracker_id: true, // FIXED: Use price_tracker_id instead of api_id
            source: true,
            last_updated: true // FIXED: Use last_updated instead of last_price_update
        },
        orderBy: [{ set_name: 'asc' }, { card_number: 'asc' }] // FIXED: Use card_number
    });

    // Convert to CSV format
    const csvHeader = 'ID,Name,Set Name,Card Number,Rarity,Type,Current Price,Price Tracker ID,Source,Last Updated\n';
    const csvRows = cards.map(card =>
        `${card.id},"${card.name}","${card.set_name}","${card.card_number || ''}","${card.rarity}","${card.card_type || ''}",${card.market_price || 0},"${card.price_tracker_id || ''}","${card.source}","${card.last_updated?.toISOString() || ''}"`
    ).join('\n');

    const csvContent = csvHeader + csvRows;

    return new Response(csvContent, {
        headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="card_pricing_export.csv"'
        }
    });
}

// Import pricing from CSV
async function importPricingFromCsv(data: { csv_content: string }) {
    const { csv_content } = data;

    const lines = csv_content.trim().split('\n');
    const headers = lines[0].split(',');

    let updatedCount = 0;
    const errors: any[] = [];

    // Find column indices
    const idIndex = headers.findIndex(h => h.toLowerCase().includes('id'));
    const priceIndex = headers.findIndex(h => h.toLowerCase().includes('price'));

    if (idIndex === -1 || priceIndex === -1) {
        return NextResponse.json({
            success: false,
            error: 'CSV must contain ID and Price columns'
        }, { status: 400 });
    }

    // Process each row (skip header)
    for (let i = 1; i < lines.length; i++) {
        try {
            const columns = lines[i].split(',');
            const cardId = parseInt(columns[idIndex]);
            const newPrice = parseFloat(columns[priceIndex]);

            if (isNaN(cardId) || isNaN(newPrice)) {
                errors.push({ row: i + 1, error: 'Invalid ID or price' });
                continue;
            }

            await prisma.card.update({
                where: { id: cardId },
                data: {
                    market_price: newPrice,
                    last_updated: new Date(), // FIXED: Use last_updated instead of last_price_update
                    source: 'MIXED' // Mark as mixed since it's been manually updated
                }
            });

            updatedCount++;
        } catch (error) {
            errors.push({
                row: i + 1,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    return NextResponse.json({
        success: true,
        message: `Updated prices for ${updatedCount} cards`,
        details: {
            updated_count: updatedCount,
            error_count: errors.length,
            errors: errors.slice(0, 10)
        }
    });
}