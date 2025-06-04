import { NextRequest } from 'next/server';
import { executeQuery } from '../../lib/db';
import { RowDataPacket } from 'mysql2/promise';

interface PriceHistoryRow extends RowDataPacket {
  id: string;
  product_id: string;
  retailer: string;
  price: number;
  recorded_at: Date;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('product_id');
    const retailer = searchParams.get('retailer');

    let query = 'SELECT id, product_id, retailer, price, recorded_at FROM priceHistory';
    const params: string[] = [];

    if (productId) {
      query += ' WHERE product_id = ?';
      params.push(productId);
      if (retailer) {
        query += ' AND retailer = ?';
        params.push(retailer);
      }
    } else if (retailer) {
      query += ' WHERE retailer = ?';
      params.push(retailer);
    }

    query += ' ORDER BY recorded_at DESC';

    const rows = await executeQuery<PriceHistoryRow[]>(query, params);

    const priceHistory = rows.map(row => ({
      id: row.id,
      product_id: row.product_id,
      retailer: row.retailer,
      price: `$${Number(row.price).toFixed(2)}`,
      recorded_at: row.recorded_at.toISOString(),
    }));

    return new Response(JSON.stringify(priceHistory), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching price history:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch price history',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}