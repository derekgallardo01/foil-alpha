import { NextRequest, NextResponse } from 'next/server';
import { getDbConnection } from '../../../lib/db';

// Helper function to handle errors
const handleError = (message: string, status: number) => {
  console.error(message);  // Log error message for debugging
  return NextResponse.json({ message }, { status });
};

// Delete a watchlist item (DELETE)
export async function DELETE(req: NextRequest) {
  const db = await getDbConnection();

  try {
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/'); // Split the URL to get the segments
    const id = pathSegments[pathSegments.length - 1]; // The last segment should be the item ID

    console.log('Extracted ID:', id); // Debugging: log the extracted ID

    // Check if the ID is valid
    if (!id) {
      return handleError('Item ID is required', 400);
    }

    if (isNaN(Number(id))) {
      return handleError('Invalid item ID', 400);
    }

    // Perform the DELETE query
    const result = await db.query("DELETE FROM watchlist WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return handleError('Item not found', 404); // No item found with that ID
    }

    return NextResponse.json({ message: "Item deleted" });
  } catch (error) {
    console.error('Failed to delete item:', error);
    return handleError('Failed to delete item', 500);
  }
}

export async function PUT(req: NextRequest) {
  const db = await getDbConnection();

  try {
    // Log the full request URL to check the query string
    const url = new URL(req.url); // Parse the URL
    console.log('Request URL:', req.url); // Check the URL
    const pathSegments = url.pathname.split('/');
    const id = pathSegments[pathSegments.length - 1]; // Extract ID from the URL path
    console.log('Extracted Item ID:', id);

    // Extract the `stock_status` from the request body
    const { stock_status } = await req.json();
    console.log('Request body for PUT:', { stock_status });

    // Validate the `id` and `stock_status`
    if (!id) {
      console.warn('Item ID is missing in PUT request.');
      return handleError('Item ID is required', 400);
    }

    if (isNaN(Number(id))) {
      console.warn('Invalid item ID:', id);
      return handleError('Invalid item ID', 400);
    }

    if (!stock_status || (stock_status !== 'in_stock' && stock_status !== 'no_stock')) {
      console.warn('Invalid stock_status:', stock_status);
      return handleError('Valid stock_status (in_stock/no_stock) is required', 400);
    }

    // Perform the update operation for stock_status (and optionally stock_quantity)
    const result = await db.query(
      "UPDATE watchlist SET stock_status = ? WHERE id = ?",
      [stock_status, id]
    );

    // If no rows were updated, the item might not exist
    if (result.affectedRows === 0) {
      console.warn('Item not found or no changes made for item ID:', id);
      return handleError('Item not found or no changes made', 404);
    }

    return NextResponse.json({ message: "Stock status updated successfully" });
  } catch (error) {
    console.error('Error updating watchlist item:', error.message, error.stack);
    return handleError('Failed to update item', 500);
  }
}
