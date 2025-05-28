// src/app/lib/db.ts
import { createPool, Pool, RowDataPacket, ResultSetHeader, PoolConnection } from "mysql2/promise";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

let pool: Pool | null = null;

interface DbConfig {
  host: string;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
  waitForConnections: boolean;
  queueLimit: number;
  idleTimeout: number;
}

const createPoolConnection = (): Pool => {
  const requiredEnv = ["MYSQL_HOST", "MYSQL_USER", "MYSQL_PASSWORD", "MYSQL_DATABASE"];
  requiredEnv.forEach((key) => {
    if (!process.env[key]) {
      throw new Error(`Environment variable ${key} is required`);
    }
  });

  const config: DbConfig = {
    host: process.env.MYSQL_HOST!,
    user: process.env.MYSQL_USER!,
    password: process.env.MYSQL_PASSWORD!,
    database: process.env.MYSQL_DATABASE!,
    connectionLimit: 5, // Reduced to avoid overwhelming DB in serverless
    waitForConnections: true,
    queueLimit: 100,
    idleTimeout: 30000, // 30 seconds idle timeout
  };

  console.log("Creating database connection pool...");
  console.log("DB Host:", config.host);
  console.log("DB User:", config.user);

  const newPool = createPool(config);

  newPool.on("error", (err) => {
    console.error("Database pool error:", err);
    pool = null; // Reset pool on fatal error
  });

  newPool.on("connection", () => {
    console.log("New pool connection established");
  });

  return newPool;
};

export const getDbConnection = async (): Promise<Pool> => {
  if (!pool || pool["_closed"]) {
    pool = createPoolConnection();
    let connection: PoolConnection | null = null;
    try {
      connection = await pool.getConnection();
      console.log("Database connection successful");
    } catch (error) {
      console.error("Database connection failed:", error);
      if (pool) {
        await pool.end().catch((err) => console.error("Error closing failed pool:", err));
      }
      pool = null;
      throw error;
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
  // Verify pool is still usable before returning
  try {
    await pool.query("SELECT 1"); // Simple test query
  } catch (error) {
    console.error("Pool is unusable, reinitializing:", error);
    pool = null;
    return getDbConnection(); // Recursively retry
  }
  return pool;
};

export const executeQuery = async <T extends RowDataPacket[] | ResultSetHeader[]>(
  query: string,
  params: any[] = []
): Promise<T> => {
  const db = await getDbConnection();
  try {
    const [rows] = await db.execute<T>(query, params);
    return rows;
  } catch (error) {
    console.error("Error executing query:", error);
    if (error instanceof Error && error.message.includes("Pool is closed")) {
      pool = null; // Reset pool
      return executeQuery(query, params); // Retry once
    }
    throw error;
  }
};

// Graceful shutdown handlers
const shutdown = async () => {
  if (pool && !pool["_closed"]) {
    await pool.end();
    console.log("Database connection pool closed");
    pool = null;
  }
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export const closeDbConnection = shutdown;