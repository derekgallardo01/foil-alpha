// src/app/api/cards/route.ts - STREAMLINED VERSION
import { NextRequest, NextResponse } from 'next/server';
import { pokemonPriceTrackerAPI } from '../../lib/pokemon-price-tracker-api';
import { prisma } from '../../lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchQuery, limit = 20, setId, cardsData, source, setImport } = body;

    console.log('V2 Cards Import Route Called');
    console.log('Request:', { searchQuery, limit, setId, cardsCount: cardsData?.length, source, setImport });

    // Process direct card data from admin import
    if (cardsData && Array.isArray(cardsData)) {
      console.log('Processing', cardsData.length, 'cards from V2 API import');

      // Debug first card
      if (cardsData[0]) {
        console.log('🔍 First card debug:', {
          cardNumber: cardsData[0].cardNumber,
          setName: cardsData[0].setName,
          imageUrl: cardsData[0].imageUrl,
          marketPrice: cardsData[0].prices?.market
        });
      }

      const results = { imported: 0, updated: 0, skipped: 0, errors: [] as any[] };

      for (const apiCard of cardsData) {
        try {
          const cardId = apiCard.id;
          if (!cardId) {
            console.error('Card missing ID:', apiCard);
            results.skipped++;
            continue;
          }

          // Extract data using EXACT V2 API field names
          const marketPrice = apiCard.prices?.market || null;
          const imageUrl = apiCard.imageUrl || null;

          console.log(`Processing: ${apiCard.name}`);
          console.log(`- Card Number: ${apiCard.cardNumber}`);
          console.log(`- Set Name: ${apiCard.setName}`);
          console.log(`- Market Price: $${marketPrice}`);
          console.log(`- Image URL: ${imageUrl ? 'Found' : 'Missing'}`);

          // Check if card exists
          const existingCard = await prisma.card.findFirst({
            where: { price_tracker_id: cardId }
          });

          // Map V2 API data to database schema using EXACT field names
          const cardData = {
            name: apiCard.name || 'Unknown Card',
            card_number: apiCard.cardNumber || 'Unknown',
            total_set_number: apiCard.totalSetNumber || null,
            rarity: apiCard.rarity || 'Common',
            card_type: apiCard.cardType || null,
            hp: apiCard.hp || null,
            stage: apiCard.stage || null,
            image_url: apiCard.imageUrl || null,
            set_id: apiCard.setId || 'unknown',
            set_name: apiCard.setName || 'Unknown Set',
            price_tracker_id: cardId,
            tcg_player_id: apiCard.tcgPlayerId || null,
            market_price: marketPrice,
            price_listings: apiCard.prices?.listings || null,
            primary_condition: apiCard.prices?.primaryCondition || 'Near Mint',
            price_last_updated: apiCard.prices?.lastUpdated ? new Date(apiCard.prices.lastUpdated) : null,
            tcg_player_url: apiCard.tcgPlayerUrl || null,
            artist: apiCard.artist || null,
            retreat_cost: apiCard.retreatCost || null,
            data_completeness: apiCard.dataCompleteness || 85,
            needs_detailed_scrape: apiCard.needsDetailedScrape || false,
            last_scraped_at: apiCard.lastScrapedAt ? new Date(apiCard.lastScrapedAt) : new Date(),
            attacks_data: apiCard.attacks || null,
            weakness_data: apiCard.weakness || null,
            resistance_data: apiCard.resistance || null,
            prices_data: apiCard.prices || null,
            ebay_data: apiCard.ebay || null,
            price_history_data: apiCard.priceHistory || null,
            price_source: 'pokemon_price_tracker_v2',
            last_updated: new Date(),
            sync_enabled: true,
            sync_errors: 0,
            source: 'API' as const,
            updated_at: new Date()
          };

          let savedCard;
          if (existingCard) {
            savedCard = await prisma.card.update({
              where: { id: existingCard.id },
              data: cardData
            });
            results.updated++;
          } else {
            savedCard = await prisma.card.create({
              data: { ...cardData, created_at: new Date() }
            });
            results.imported++;
          }

          console.log(`✅ ${existingCard ? 'Updated' : 'Imported'}: ${apiCard.name} - Price: $${marketPrice} - Image: ${savedCard.image_url ? 'YES' : 'NO'}`);

          // Create price history
          if (marketPrice) {
            await prisma.price_history.create({
              data: {
                card_id: savedCard.id,
                price: marketPrice,
                source: 'pokemon_price_tracker_v2',
                price_type: 'market',
                condition: cardData.primary_condition || 'Near Mint'
              }
            });
          }

        } catch (error) {
          console.error(`❌ Error processing card ${apiCard.id}:`, error);
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
    }

    // API search logic (for when searchQuery or setId is provided)
    // ... rest of your API search code
    let searchResponse;

    if (setId) {
      console.log(`Importing V2 set: ${setId}`);
      searchResponse = await pokemonPriceTrackerAPI.getSetPricing(setId);
    } else if (searchQuery) {
      console.log(`Searching V2 API for: "${searchQuery}"`);
      searchResponse = await pokemonPriceTrackerAPI.searchCardPricing({
        name: searchQuery,
        limit: Math.min(limit, 20)
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Either searchQuery, setId, or cardsData is required'
      }, { status: 400 });
    }

    if (!searchResponse.success) {
      console.error('V2 API search failed:', searchResponse.error);
      return NextResponse.json({
        success: false,
        error: searchResponse.error || 'API request failed'
      });
    }

    const apiCardsData = searchResponse.data;
    console.log('V2 API returned cards:', Array.isArray(apiCardsData) ? apiCardsData.length : 'not array');

    if (!Array.isArray(apiCardsData) || apiCardsData.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No cards found',
        results: { imported: 0, updated: 0, skipped: 0, errors: [] }
      });
    }

    // Recursively process V2 API data
    const recursiveRequest = {
      json: async () => ({
        cardsData: apiCardsData,
        source: 'pokemon_price_tracker_v2_api'
      })
    } as NextRequest;

    return await POST(recursiveRequest);

  } catch (error) {
    console.error('V2 Import error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}