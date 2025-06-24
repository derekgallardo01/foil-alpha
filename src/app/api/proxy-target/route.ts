import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request) {
  console.log('Proxy route hit: /api/proxy-target', {
    timestamp: new Date().toISOString(),
    url: req.url,
    method: req.method,
  });

  const { searchParams } = new URL(req.url);
  const tcin = searchParams.get('tcin');
  const store_id = searchParams.get('store_id');
  const zip = searchParams.get('zip');
  const state = searchParams.get('state');
  const latitude = searchParams.get('latitude');
  const longitude = searchParams.get('longitude');
  const scheduled_delivery_store_id = searchParams.get('scheduled_delivery_store_id');
  const visitor_id = searchParams.get('visitor_id');

  if (!tcin || !store_id || !zip || !state || !latitude || !longitude || !scheduled_delivery_store_id || !visitor_id) {
    console.error('Proxy: Missing query parameters', {
      timestamp: new Date().toISOString(),
      searchParams: Object.fromEntries(searchParams),
    });
    return NextResponse.json(
      { error: 'Missing required query parameters' },
      { status: 400 }
    );
  }

  const targetUrl = `https://redsky.target.com/redsky_aggregations/v1/web/product_fulfillment_v1?key=9f36aeafbe60771e321a7cc95a78140772ab3e96&is_bot=false&tcin=${tcin}&store_id=${store_id}&zip=${zip}&state=${state}&latitude=${latitude}&longitude=${longitude}&scheduled_delivery_store_id=${scheduled_delivery_store_id}&paid_membership=false&base_membership=false&card_membership=false&required_store_id=${store_id}&visitor_id=${visitor_id}&channel=WEB&page=%2Fp%2FA-${tcin}`;

  try {
    console.log('Proxy: Initiating request to Target API:', {
      url: targetUrl,
      timestamp: new Date().toISOString(),
    });

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No response body');
      console.error('Proxy: Target API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        { error: `Target API error: ${response.statusText}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Proxy: Target API response data:', JSON.stringify(data, null, 2));

    if (!data?.data?.product?.fulfillment) {
      console.error('Proxy: Invalid response structure', {
        timestamp: new Date().toISOString(),
        data: JSON.stringify(data, null, 2),
      });
      return NextResponse.json(
        { error: 'Invalid response structure from Target API' },
        { status: 500 }
      );
    }

    // Save to database
    const fulfillment = data.data.product.fulfillment;
    const productId = parseInt(tcin); // Use TCIN as product_id
    const now = new Date();

    try {
      // Debug: Log available Prisma models
      console.log('Prisma models:', Object.keys(prisma));

      // Ensure product exists
      await prisma.product.upsert({
        where: { tcin: tcin! }, // Use tcin as unique field; non-null assertion since tcin is checked
        update: {
          title: 'Pokémon Trading Card Game: Scarlet & Violet—Prismatic Evolutions Super-Premium Collection',
          url: `https://www.target.com/p/A-${tcin}`,
          stock_status: fulfillment.store_options?.[0]?.order_pickup?.availability_status || 'UNKNOWN',
          retailer: 'Target',
        },
        create: {
          product_id: productId,
          tcin: tcin!,
          title: 'Pokémon Trading Card Game: Scarlet & Violet—Prismatic Evolutions Super-Premium Collection',
          url: `https://www.target.com/p/A-${tcin}`,
          stock_status: fulfillment.store_options?.[0]?.order_pickup?.availability_status || 'UNKNOWN',
          retailer: 'Target',
        },
      });

      // Save stock check to pricehistory
      await prisma.priceHistory.create({
        data: {
          product_id: productId,
          retailer: 'Target',
          price: 89.99, // Placeholder; update if Target API provides price
          recorded_at: now,
          stock_status: fulfillment.store_options?.[0]?.order_pickup?.availability_status || 'UNKNOWN',
          store_quantity: fulfillment.store_options?.[0]?.location_available_to_promise_quantity || 0,
          ship_quantity: fulfillment.shipping_options?.available_to_promise_quantity || 0,
        },
      });

      console.log('Database: Stock data saved successfully', {
        product_id: productId,
        timestamp: now.toISOString(),
      });
    } catch (dbError) {
      console.error('Database: Failed to save stock data', {
        error: dbError instanceof Error ? dbError.message : 'Unknown error',
        stack: dbError instanceof Error ? dbError.stack : undefined,
        timestamp: new Date().toISOString(),
      });
      // Continue with response even if DB save fails
    }

    return NextResponse.json(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Proxy: Request failed:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { error: 'Failed to fetch from Target API', details: errorMessage },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}