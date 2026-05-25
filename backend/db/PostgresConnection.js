const { Pool } = require("pg");

let pool = null;

/**
 * Initialize PostgreSQL connection pool
 */
const initializePostgres = async () => {
  try {
    const config = {
      user: process.env.PG_USER || "chatuser",
      password: process.env.PG_PASSWORD || "chatpass",
      host: process.env.PG_HOST || "localhost",
      port: process.env.PG_PORT || 5432,
      database: process.env.PG_DB || "chatdb",
    };

    pool = new Pool({
      ...config,
    });

    // Test connection
    const client = await pool.connect();
    console.log("✓ PostgreSQL connection successful");
    client.release();

    return pool;
  } catch (error) {
    console.error("✗ PostgreSQL connection failed:", {
      message: error.message,
      host: process.env.PG_HOST || "localhost",
      port: process.env.PG_PORT || 5432,
      database: process.env.PG_DB || "chatdb",
      user: process.env.PG_USER || "chatuser",
    });
    process.exit(1);
  }
};

/**
 * Get the connection pool
 */
const getPool = () => {
  if (!pool) {
    throw new Error("PostgreSQL not initialized. Call initializePostgres() first.");
  }
  return pool;
};

/**
 * Execute a query
 */
const query = async (sql, params = []) => {
  try {
    const result = await pool.query(sql, params);
    return result;
  } catch (error) {
    console.error("Query error:", error);
    throw error;
  }
};

/**
 * Close the connection pool
 */
const close = async () => {
  if (pool) {
    await pool.end();
    console.log("PostgreSQL connection closed");
  }
};

module.exports = {
  initializePostgres,
  getPool,
  query,
  close,
};
