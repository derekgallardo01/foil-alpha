import { createPool, Pool, RowDataPacket, ResultSetHeader, PoolConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
import { EventEmitter } from "events";

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
    connectionLimit: 5,
    waitForConnections: true,
    queueLimit: 100,
    idleTimeout: 30000,
  };

  console.log("Creating database connection pool...");
  console.log("DB Host:", config.host);
  console.log("DB User:", config.user);

  const newPool = createPool(config);

  // Type assertion to EventEmitter for error event
  (newPool as unknown as EventEmitter).on("error", (err: Error) => {
    console.error("Database pool error:", err);
    pool = null;
  });

  newPool.on("connection", () => {
    console.log("New pool connection established");
  });

  return newPool;
};

export const getDbConnection = async (): Promise<Pool> => {
  if (!pool) {
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
  // Verify pool is still usable
  try {
    await pool.query("SELECT 1");
  } catch (error) {
    console.error("Pool is unusable, reinitializing:", error);
    pool = null;
    return getDbConnection(); // Recursively retry
  }
  return pool;
};

// Define allowed query parameter types
type QueryParam = string | number | boolean | null | undefined | Buffer | Date;

export const executeQuery = async <T extends RowDataPacket[] | ResultSetHeader[]>(
  query: string,
  params: QueryParam[] = []
): Promise<T> => {
  const db = await getDbConnection();
  try {
    const [rows] = await db.execute<T>(query, params);
    return rows;
  } catch (error) {
    console.error("Error executing query:", error);
    if (error instanceof Error && error.message.includes("Pool is closed")) {
      pool = null;
      return executeQuery(query, params); // Retry once
    }
    throw error;
  }
};

// Graceful shutdown handlers
const shutdown = async () => {
  if (pool) {
    try {
      await pool.query("SELECT 1"); // Check if pool is still active
      await pool.end();
      console.log("Database connection pool closed");
    } catch (error) {
      console.error("Error during pool shutdown:", error);
    } finally {
      pool = null;
    }
  }
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export const closeDbConnection = shutdown;