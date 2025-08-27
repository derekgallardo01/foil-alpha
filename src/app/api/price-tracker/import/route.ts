import { NextRequest, NextResponse } from 'next/server';
import { pokemonPriceTrackerAPI, PokemonPriceTrackerAPI } from '../../../lib/pokemon-price-tracker-api';
import { prisma } from '../../../lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { searchQuery, limit = 10 } = body;

        if (!searchQuery) {
            return NextResponse.json({
                success: false,
                error: 'Search query is required'
            }, { status: 400 });
        }

        console.log(`Searching for: "${searchQuery}"`);

        // Search for cards
        const searchResponse = await pokemonPriceTrackerAPI.searchCardPricing({
            name: searchQuery,
            limit: Math.min(limit, 20)
        });

        // DEBUG: Log the actual response structure
        console.log('Full API Response:', JSON.stringify(searchResponse, null, 2));
        console.log('Response data type:', typeof searchResponse.data);
        console.log('Response data:', searchResponse.data);

        if (!searchResponse.success) {
            return NextResponse.json({
                success: false,
                error: searchResponse.error || 'Search failed'
            });
        }

        // Check if data is an array or needs to be extracted differently
        let cardsData: any = searchResponse.data;

        // Handle different response structures
        if (cardsData && typeof cardsData === 'object' && !Array.isArray(cardsData)) {
            // If the response has a nested structure, try to extract the array
            if (cardsData.cards && Array.isArray(cardsData.cards)) {
                cardsData = cardsData.cards;
            } else if (cardsData.data && Array.isArray(cardsData.data)) {
                cardsData = cardsData.data;
            } else if (cardsData.results && Array.isArray(cardsData.results)) {
                cardsData = cardsData.results;
            } else {
                // Single card response - wrap in array
                cardsData = [cardsData];
            }
        }

        if (!Array.isArray(cardsData)) {
            return NextResponse.json({
                success: false,
                error: 'Unexpected API response format',
                debug: {
                    responseType: typeof searchResponse.data,
                    responseKeys: searchResponse.data ? Object.keys(searchResponse.data) : 'null',
                    rawResponse: searchResponse.data
                }
            });
        }

        if (cardsData.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No cards found for the search query',
                results: { imported: 0, updated: 0, skipped: 0, errors: [] }
            });
        }

        const results = {
            imported: 0,
            updated: 0,
            skipped: 0,
            errors: [] as any[]
        };

        // Process each card
        for (const apiCard of cardsData) {
            try {
                const priceTrackerId = apiCard.id;
                const marketPrice = PokemonPriceTrackerAPI.getBestMarketPrice(apiCard);

                console.log(`Processing card: ${apiCard.name} (${priceTrackerId}) - $${marketPrice}`);

                // Use raw SQL to check if card exists
                const existingCards = await prisma.$queryRaw<Array<{ id: number }>>`
                    SELECT id FROM cards 
                    WHERE price_tracker_id = ${priceTrackerId} 
                    LIMIT 1
                `;

                if (existingCards.length > 0) {
                    // Update existing card using raw SQL
                    await prisma.$executeRaw`
                        UPDATE cards 
                        SET 
                            market_price = ${marketPrice},
                            last_price_update = NOW(),
                            sync_errors = 0,
                            updated_at = NOW()
                        WHERE id = ${existingCards[0].id}
                    `;

                    results.updated++;
                    console.log(`Updated: ${apiCard.name} - $${marketPrice}`);
                } else {
                    // Create new card using raw SQL
                    await prisma.$executeRaw`
                        INSERT INTO cards (
                            name, set_name, set_number, rarity, card_type, 
                            image_url, small_image_url, price_tracker_id, 
                            market_price, last_price_update, sync_enabled, 
                            sync_errors, source, created_at, updated_at
                        ) VALUES (
                            ${apiCard.name}, 
                            ${apiCard.setName}, 
                            ${apiCard.number}, 
                            ${apiCard.rarity || 'Unknown'}, 
                            'Pokemon',
                            ${apiCard.imageUrl || null}, 
                            ${apiCard.imageUrl || null}, 
                            ${priceTrackerId}, 
                            ${marketPrice}, 
                            NOW(), 
                            1, 
                            0, 
                            'API', 
                            NOW(), 
                            NOW()
                        )
                    `;

                    results.imported++;
                    console.log(`Imported: ${apiCard.name} - $${marketPrice}`);
                }

            } catch (error) {
                console.error(`Error processing card ${apiCard.id}:`, error);
                results.errors.push({
                    cardId: apiCard.id,
                    cardName: apiCard.name,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        return NextResponse.json({
            success: true,
            message: `Import completed: ${results.imported} imported, ${results.updated} updated, ${results.errors.length} errors`,
            results
        });

    } catch (error) {
        console.error('Import error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}