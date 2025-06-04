import { executeQuery } from '../../lib/db';
import { RowDataPacket } from 'mysql2';

interface ProductRow extends RowDataPacket {
  product_id: string;
  retailer: string;
  title: string;
  url: string;
  image: string;
  screenshot: string;
  stock_status: string;
  price: number | null;
  recorded_at: Date | null;
  release_date: Date | null;
}

interface ProductResponse {
  product_id: string;
  retailer: string;
  title: string;
  url: string;
  image: string;
  screenshot: string;
  stockStatus: string;
  price: string;
  recorded_at: string | null;
  release_date: string | null;
}

export async function GET() {
  try {
    console.log('Fetching products from database...');
    
    const query = `
      SELECT 
        p.product_id, 
        p.retailer, 
        p.title, 
        p.url, 
        p.image, 
        p.screenshot, 
        p.stock_status,
        p.release_date,
        ph.price,
        ph.recorded_at
      FROM products p
      LEFT JOIN (
        SELECT product_id, price, recorded_at
        FROM priceHistory
        WHERE (product_id, recorded_at) IN (
          SELECT product_id, MAX(recorded_at)
          FROM priceHistory
          GROUP BY product_id
        )
      ) ph ON p.product_id = ph.product_id
    `;

    const rows = await executeQuery<ProductRow[]>(query);

    const products: ProductResponse[] = rows.map(row => ({
      product_id: row.product_id,
      retailer: row.retailer,
      title: row.title,
      url: row.url,
      image: row.image,
      screenshot: row.screenshot,
      stockStatus: row.stock_status,
      price: row.price !== null ? `$${Number(row.price).toFixed(2)}` : 'Price not found',
      recorded_at: row.recorded_at ? row.recorded_at.toISOString() : null,
      release_date: row.release_date ? row.release_date.toISOString() : null,
    }));

    return new Response(JSON.stringify(products), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=59'
      },
    });
  } catch (error) {
    console.error('Error fetching products from database:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch products',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}