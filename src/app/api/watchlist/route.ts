import { NextRequest, NextResponse } from 'next/server';
import { getDbConnection } from '../../lib/db';

// Helper function to handle errors with logging
const handleError = (message: string, status: number) => {
  console.error(message);  // Log error message for debugging
  return NextResponse.json({ message }, { status });
};

// Fetch the watchlist for the current user (GET)
export async function GET(req: NextRequest) {
  const db = await getDbConnection(); // Ensure you get the database connection

  try {
    console.log('Full URL:', req.url);
    const url = new URL(req.url);
    const user_id = url.searchParams.get('user_id'); // Get user_id from the query string
    console.log('Received user_id:', user_id);

    if (!user_id) {
      console.warn('User ID is missing in the request.');
      return handleError('User ID is required', 400);
    }

    const [watchlistItems] = await db.query("SELECT * FROM watchlist WHERE user_id = ?", [user_id]);

    console.log('Fetched watchlist items:', watchlistItems);

    if (watchlistItems.length === 0) {
      console.warn('No items found in the watchlist for user_id:', user_id);
      return handleError('No items found in the watchlist', 404);
    }

    return NextResponse.json(watchlistItems);
  } catch (error) {
    console.error('Error fetching watchlist:', error.message, error.stack);
    return handleError('Error fetching watchlist', 500);
  }
}

// Add a new watchlist item (POST)
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

    // Insert the new item into the watchlist
    const [newItemResult] = await db.query(
      "INSERT INTO watchlist (retailer_name, product_url, product_title, price, stock_quantity, stock_status, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [retailer_name, product_url, product_title, price, stock_quantity, stock_status, user_id]
    );

    console.log('New item inserted with ID:', newItemResult.insertId);

    // Fetch the inserted item from the database to ensure consistency
    const [newItem] = await db.query(
      "SELECT * FROM watchlist WHERE id = ?",
      [newItemResult.insertId]
    );

    return NextResponse.json({ message: "Item added", newItem: newItem[0] });
  } catch (error) {
    console.error('Error adding to watchlist:', error.message, error.stack);
    return handleError('Error adding to watchlist', 500);
  }
}

// Delete a watchlist item (DELETE)
export async function DELETE(req: NextRequest) {
  const db = await getDbConnection();

  try {
    // Extract the item ID from the URL path (not searchParams)
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/');
    const id = pathSegments[pathSegments.length - 1];  // The last segment should be the item ID

    console.log('Received DELETE request for item ID:', id);

    if (!id) {
      console.warn('Item ID is missing in DELETE request.');
      return handleError('Item ID is required', 400);
    }

    if (isNaN(Number(id))) {
      console.warn('Invalid item ID:', id);
      return handleError('Invalid item ID', 400);
    }

    const result = await db.query("DELETE FROM watchlist WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      console.warn('Item not found with ID:', id);
      return handleError('Item not found', 404);
    }

    return NextResponse.json({ message: "Item deleted" });
  } catch (error) {
    console.error('Failed to delete item:', error.message, error.stack);
    return handleError('Failed to delete item', 500);
  }
}

// Update a watchlist item (PUT) - Corrected to handle ID from URL path
// Update a watchlist item (PUT) - Corrected to return the updated item
export async function PUT(req: NextRequest) {
    const db = await getDbConnection();

    try {
        const url = new URL(req.url);
        const id = url.searchParams.get('id');
        const { stock_quantity, stock_status } = await req.json(); // Include stock_status

        //... (validation – same as before)

        // Perform the update operation (using a more flexible approach)
        let updateQuery = "UPDATE watchlist SET stock_quantity =?";
        const updateParams = [stock_quantity];

        if (stock_status!== undefined) { // Add stock_status update if provided
            updateQuery += ", stock_status =?";
            updateParams.push(stock_status);
        }
        updateQuery += " WHERE id =?";
        updateParams.push(id);

         const result = await db.query(updateQuery, updateParams);

        if (result.affectedRows === 0) {
            return handleError('Item not found or no changes made', 404);
        }

        // Fetch the updated item
        const [updatedItem] = await db.query("SELECT * FROM watchlist WHERE id =?", [id]);


        if (!updatedItem || updatedItem.length === 0) {
            console.error("Failed to retrieve updated item after update.");
            return handleError("Failed to retrieve updated item", 500);
        }

        // Corrected line: return the first item in the array
        return NextResponse.json({ newItem: updatedItem });

    } catch (error) {
        //... (error handling – same as before)
    }
}


