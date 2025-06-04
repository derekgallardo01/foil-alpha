// src/app/api/visitor-count/route.ts
import { NextResponse } from 'next/server';
import { getDbConnection } from '../../lib/db';
import { RowDataPacket } from 'mysql2/promise'; // Import RowDataPacket

interface VisitorCountRow extends RowDataPacket {
  count: number;
}

export async function GET() {
  try {
    const pool = await getDbConnection(); // Get the connection pool
    const connection = await pool.getConnection(); // Get a connection from the pool

    // Execute the query to get the visitor count
    const [rows] = await connection.execute<VisitorCountRow[]>('SELECT count FROM visitor_count WHERE id = 1');

    connection.release(); // Release the connection back to the pool

    console.log('Database response:', rows); // Log the raw database response

    // Return the visitor count as a JSON response
    return NextResponse.json({ count: rows[0]?.count || 0 });
  } catch (error) {
    console.error('Error fetching visitor count:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}