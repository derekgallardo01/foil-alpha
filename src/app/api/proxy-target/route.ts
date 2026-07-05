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

    // NOTE: Target stock persistence is disabled. The `product` model and the
    // retailer-style price history table this route was written against are not
    // part of the current Prisma schema, so the fetched stock data is returned
    // to the caller but not stored server-side.
    console.log('Proxy: Target stock data (not persisted — no product/priceHistory model in schema)', {
      product_id: productId,
      stock_status: fulfillment.store_options?.[0]?.order_pickup?.availability_status || 'UNKNOWN',
      store_quantity: fulfillment.store_options?.[0]?.location_available_to_promise_quantity || 0,
      ship_quantity: fulfillment.shipping_options?.available_to_promise_quantity || 0,
      timestamp: now.toISOString(),
    });

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