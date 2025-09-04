// src/app/api/cards/route.ts - CLEAN V2 VERSION
import { NextRequest, NextResponse } from 'next/server';
import { pokemonPriceTrackerAPI, PokemonPriceTrackerAPI } from '../../lib/pokemon-price-tracker-api';
import { prisma } from '../../lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchQuery, limit = 20, setId, cardsData, source, setImport } = body;

    console.log('V2 Cards Import Route Called');
    console.log('Request:', { searchQuery, limit, setId, cardsCount: cardsData?.length, source, setImport });

    // Process direct card data from admin import
    if (cardsData && Array.isArray(cardsData)) {
      console.log('Processing', cardsData.length, 'cards from admin import');

      const results = {
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: [] as any[]
      };

      for (const apiCard of cardsData) {
        try {
          const priceTrackerId = apiCard.id;
          let marketPrice = apiCard.marketPrice; // From admin client

          // Extract price from V2 API structure if available
          if (!marketPrice && apiCard.prices?.market) {
            marketPrice = apiCard.prices.market;
          }

          console.log(`Processing: ${apiCard.name} (${priceTrackerId}) - $${marketPrice}`);

          // Check if card exists
          const existingCard = await prisma.card.findFirst({
            where: { price_tracker_id: priceTrackerId }
          });

          // Map V2 API data to clean schema
          const cardData = {
            name: apiCard.name,
            card_number: apiCard.cardNumber || apiCard.number || 'Unknown',
            total_set_number: apiCard.totalSetNumber || undefined,
            rarity: apiCard.rarity || 'Common',
            card_type: apiCard.cardType || undefined,
            hp: apiCard.hp || undefined,
            stage: apiCard.stage || undefined,
            image_url: apiCard.imageUrl || apiCard.images?.small || undefined,
            set_id: apiCard.setId || apiCard.set?.id || 'unknown',
            set_name: apiCard.setName || apiCard.set?.name || 'Unknown Set',
            price_tracker_id: priceTrackerId,
            tcg_player_id: apiCard.tcgPlayerId || undefined,

            // V2 Pricing fields
            market_price: marketPrice,
            price_listings: apiCard.prices?.listings || undefined,
            primary_condition: apiCard.prices?.primaryCondition || undefined,
            price_last_updated: apiCard.prices?.lastUpdated ? new Date(apiCard.prices.lastUpdated) : undefined,

            // V2 Additional fields
            tcg_player_url: apiCard.tcgPlayerUrl || undefined,
            artist: apiCard.artist || undefined,
            retreat_cost: apiCard.retreatCost || undefined,
            data_completeness: apiCard.dataCompleteness || undefined,
            needs_detailed_scrape: apiCard.needsDetailedScrape || false,
            last_scraped_at: apiCard.lastScrapedAt ? new Date(apiCard.lastScrapedAt) : undefined,

            // V2 JSON data storage
            attacks_data: apiCard.attacks ? apiCard.attacks : undefined,
            weakness_data: apiCard.weakness ? apiCard.weakness : undefined,
            resistance_data: apiCard.resistance ? apiCard.resistance : undefined,
            prices_data: apiCard.prices ? apiCard.prices : undefined,
            ebay_data: apiCard.ebay ? apiCard.ebay : undefined,
            price_history_data: apiCard.priceHistory ? apiCard.priceHistory : undefined,

            // Sync metadata
            price_source: 'pokemon_price_tracker_v2',
            last_updated: new Date(),
            sync_enabled: true,
            sync_errors: 0,

            // App fields
            featured: false,
            view_count: 0,
            source: 'API' as const,
            updated_at: new Date()
          };

          if (existingCard) {
            await prisma.card.update({
              where: { id: existingCard.id },
              data: cardData
            });
            results.updated++;
            console.log(`Updated: ${apiCard.name}`);
          } else {
            await prisma.card.create({
              data: {
                ...cardData,
                created_at: new Date()
              }
            });
            results.imported++;
            console.log(`Imported: ${apiCard.name} - $${marketPrice}`);
          }

          // Create price history entry
          if (marketPrice) {
            const cardForHistory = existingCard || await prisma.card.findFirst({
              where: { price_tracker_id: priceTrackerId }
            });

            if (cardForHistory) {
              await prisma.price_history.create({
                data: {
                  card_id: cardForHistory.id,
                  price: marketPrice,
                  source: 'pokemon_price_tracker_v2',
                  price_type: 'market',
                  condition: cardData.primary_condition || undefined,
                  metadata: {
                    import_batch: true,
                    api_source: 'pokemon_price_tracker_v2',
                    tcg_player_id: cardData.tcg_player_id,
                    data_completeness: cardData.data_completeness,
                    has_price_history: !!apiCard.priceHistory,
                    has_ebay_data: !!apiCard.ebay
                  }
                }
              });
            }
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
    }

    // API-based import
    let searchResponse;

    if (setId) {
      console.log(`Importing set: ${setId}`);
      searchResponse = await pokemonPriceTrackerAPI.getSetPricing(setId);
    } else if (searchQuery) {
      console.log(`Searching for: "${searchQuery}"`);
      searchResponse = await pokemonPriceTrackerAPI.searchCardPricing({
        name: searchQuery,
        limit: Math.min(limit, 50)
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Either searchQuery, setId, or cardsData is required'
      }, { status: 400 });
    }

    if (!searchResponse.success) {
      return NextResponse.json({
        success: false,
        error: searchResponse.error || 'API request failed'
      });
    }

    const apiCardsData = searchResponse.data;
    if (!Array.isArray(apiCardsData) || apiCardsData.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No cards found',
        results: { imported: 0, updated: 0, skipped: 0, errors: [] }
      });
    }

    // Recursively process API data
    const recursiveRequest = {
      json: async () => ({
        cardsData: apiCardsData,
        source: 'pokemon_price_tracker_v2_api'
      })
    } as NextRequest;

    return await POST(recursiveRequest);

  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}