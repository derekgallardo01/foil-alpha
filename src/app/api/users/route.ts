// src/app/api/users/route.ts
import { NextResponse } from 'next/server';
import { getDbConnection } from '../../lib/db';

export async function GET() {
  // Use await to get the connection pool
  const dbConnection = await getDbConnection();

  // Log the dbConnection to ensure it's initialized properly
  console.log('DB Connection:', dbConnection);

  if (!dbConnection) {
    return NextResponse.json({ message: 'Failed to connect to the database' }, { status: 500 });
  }

  try {
    // Modify the query to also fetch the 'role' field
    const [rows] = await dbConnection.execute('SELECT id, name, email, role FROM users');
    
    // Return the users as a JSON response
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ message: 'Error fetching users' }, { status: 500 });
  }
}
