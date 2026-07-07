import { NextResponse } from 'next/server';
import { getDbConnection } from '../../lib/db';
import { requireAdmin } from '../../lib/auth';

export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("response" in auth) return auth.response;

    // Use your existing DB connection
    const dbConnection = await getDbConnection();

    if (!dbConnection) {
      return NextResponse.json({ error: 'Failed to connect to the database' }, { status: 500 });
    }

    // Fetch users with additional fields
    const [rows] = await dbConnection.execute(
      'SELECT id, name, email, role, registeredAt, is_verified FROM users ORDER BY registeredAt DESC'
    );

    // Return in the format expected by the admin page
    return NextResponse.json({
      users: rows
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Error fetching users' }, { status: 500 });
  }
}