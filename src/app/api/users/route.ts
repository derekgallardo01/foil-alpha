// src/app/api/users/route.ts - Updated to work with your existing setup
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { getDbConnection } from '../../lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

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