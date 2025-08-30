// src/app/api/cards/route.ts - FIXED VERSION
import { NextRequest, NextResponse } from 'next/server';
import { pokemonPriceTrackerAPI, PokemonPriceTrackerAPI } from '../../lib/pokemon-price-tracker-api';
import { prisma } from '../../lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchQuery, limit = 20, setId } = body;

    console.log('Card import request:', { searchQuery, limit, setId });

    let searchResponse;

    if (setId) {
      // Import entire set
      console.log(`Importing entire set: ${setId}`);
      searchResponse = await pokemonPriceTrackerAPI.getSetPricing(setId);
    } else if (searchQuery) {
      // Search for specific cards
      console.log(`Searching for: "${searchQuery}"`);
      searchResponse = await pokemonPriceTrackerAPI.searchCardPricing({
        name: searchQuery,
        limit: Math.min(limit, 50)
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Either searchQuery or setId is required'
      }, { status: 400 });
    }

    console.log('API Response:', searchResponse);

    if (!searchResponse.success) {
      return NextResponse.json({
        success: false,
        error: searchResponse.error || 'API request failed'
      });
    }

    const cardsData = searchResponse.data;
    if (!Array.isArray(cardsData) || cardsData.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No cards found',
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
        const priceTrackerId = apiCard.id; // setId-cardNumber format
        const marketPrice = PokemonPriceTrackerAPI.getBestMarketPrice(apiCard);
        const priceTrend = marketPrice ? 'stable' : null;

        console.log(`Processing: ${apiCard.name} (${priceTrackerId}) - $${marketPrice}`);

        // Check if card exists
        const existingCard = await prisma.card.findFirst({
          where: { price_tracker_id: priceTrackerId }
        });

        if (existingCard) {
          // Update existing card
          await prisma.card.update({
            where: { id: existingCard.id },
            data: {
              market_price: marketPrice,
              price_trend: priceTrend,
              last_price_update: new Date(),
              sync_errors: 0,
              updated_at: new Date()
            }
          });
          results.updated++;
          console.log(`Updated: ${apiCard.name}`);
        } else {
          // Create new card
          await prisma.card.create({
            data: {
              name: apiCard.name,
              set_name: apiCard.setName,
              set_number: apiCard.number || 'Unknown',
              rarity: apiCard.rarity || 'Common',
              card_type: 'Pokemon', // Default type
              image_url: apiCard.imageUrl || null,
              small_image_url: apiCard.imageUrl || null,
              price_tracker_id: priceTrackerId,
              market_price: marketPrice,
              price_trend: priceTrend,
              last_price_update: new Date(),
              sync_enabled: true,
              sync_errors: 0,
              source: 'API',
              created_at: new Date(),
              updated_at: new Date()
            }
          });
          results.imported++;
          console.log(`Imported: ${apiCard.name}`);
        }

        // Create price history entry
        if (marketPrice) {
          await prisma.price_history.create({
            data: {
              card_id: existingCard?.id || (await prisma.card.findFirst({
                where: { price_tracker_id: priceTrackerId }
              }))!.id,
              price: marketPrice,
              source: 'pokemon_price_tracker',
              recorded_at: new Date(),
              metadata: {
                import_batch: true,
                api_source: 'pokemon_price_tracker',
                pricing_sources: apiCard.prices
              }
            }
          });
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

    console.log('Import results:', results);

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