import { NextRequest, NextResponse } from 'next/server';
import { getDbConnection } from '../../lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise'; // Import mysql2 types

// Define the WatchlistItem interface for type safety
interface WatchlistItem extends RowDataPacket {
  id: number;
  retailer_name: string;
  product_url?: string;
  product_title: string;
  price: number;
  stock_quantity: number;
  stock_status?: string;
  user_id: number;
}

// Helper function to handle errors with logging
const handleError = (message: string, status: number) => {
  console.error(message);
  return NextResponse.json({ message }, { status });
};

// Fetch the watchlist for the current user (GET)
export async function GET(req: NextRequest) {
  const db = await getDbConnection();

  try {
    console.log('Full URL:', req.url);
    const url = new URL(req.url);
    const user_id = url.searchParams.get('user_id');
    console.log('Received user_id:', user_id);

    if (!user_id) {
      console.warn('User ID is missing in the request.');
      return handleError('User ID is required', 400);
    }

    if (isNaN(Number(user_id))) {
      console.warn('Invalid user ID:', user_id);
      return handleError('Invalid user ID', 400);
    }

    // Type the query result as an array of WatchlistItem
    const [watchlistItems] = await db.query<WatchlistItem[]>(
      'SELECT * FROM watchlist WHERE user_id = ?',
      [user_id]
    );

    console.log('Fetched watchlist items:', watchlistItems);

    if (watchlistItems.length === 0) {
      console.warn('No items found in the watchlist for user_id:', user_id);
      return handleError('No items found in the watchlist', 404);
    }

    return NextResponse.json(watchlistItems);
  } catch (error) {
    console.error('Error fetching watchlist:', { message: (error as Error).message, stack: (error as Error).stack });
    return handleError('Error fetching watchlist', 500);
  }
}

// Add a new watchlist item (POST)
export async function POST(req: NextRequest) {
  const db = await getDbConnection();

  try {
    const body = await req.json();
    console.log('Request body for POST:', body);

    const { retailer_name, product_url, product_title, price, stock_quantity, stock_status, user_id } = body;

    if (!retailer_name || !product_title || !price || !user_id) {
      console.warn('Missing required fields:', { retailer_name, product_title, price, user_id });
      return handleError('Missing required fields: retailer_name, product_title, price, and user_id are required.', 400);
    }

    if (isNaN(Number(price)) || isNaN(Number(stock_quantity))) {
      console.warn('Invalid price or stock_quantity:', { price, stock_quantity });
      return handleError('Price and stock_quantity must be valid numbers.', 400);
    }

    if (isNaN(Number(user_id))) {
      console.warn('Invalid user ID:', user_id);
      return handleError('Invalid user ID', 400);
    }

    // Type the INSERT query result as ResultSetHeader
    const [newItemResult] = await db.query<ResultSetHeader>(
      'INSERT INTO watchlist (retailer_name, product_url, product_title, price, stock_quantity, stock_status, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [retailer_name, product_url, product_title, price, stock_quantity, stock_status, user_id]
    );

    console.log('New item inserted with ID:', newItemResult.insertId);

    // Fetch the inserted item, typed as WatchlistItem[]
    const [newItem] = await db.query<WatchlistItem[]>(
      'SELECT * FROM watchlist WHERE id = ?',
      [newItemResult.insertId]
    );

    if (!newItem || newItem.length === 0) {
      console.error('Failed to retrieve inserted item for ID:', newItemResult.insertId);
      return handleError('Failed to retrieve inserted item', 500);
    }

    return NextResponse.json({ message: 'Item added', newItem: newItem[0] });
  } catch (error) {
    console.error('Error adding to watchlist:', { message: (error as Error).message, stack: (error as Error).stack });
    return handleError('Error adding to watchlist', 500);
  }
}