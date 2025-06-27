import { createPool } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  const pool = createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    connectionLimit: 5,
  });

  try {
    const [rows] = await pool.query('SELECT 1');
    console.log('mysql2 connection successful:', rows);
  } catch (error) {
    console.error('mysql2 connection failed:', error);
  } finally {
    await pool.end();
  }
}

testConnection();