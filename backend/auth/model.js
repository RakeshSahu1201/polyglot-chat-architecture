const { query } = require("../db/PostgresConnection");

/**
 * Create users table if it doesn't exist
 */
const initializeUserTable = async () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `;

  try {
    await query(sql);
    console.log("✓ Users table initialized");
  } catch (error) {
    console.error("✗ Failed to initialize users table:", error.message);
    throw error;
  }
};

/**
 * Create a new user
 */
const createUser = async (email, password_hash, name) => {
  const sql = `
    INSERT INTO users (email, password_hash, name)
    VALUES ($1, $2, $3)
    RETURNING id, email, name, created_at;
  `;

  try {
    const result = await query(sql, [email, password_hash, name]);
    return result.rows[0];
  } catch (error) {
    if (error.code === "23505") {
      // Unique constraint violation
      throw new Error("Email already exists");
    }
    throw error;
  }
};

/**
 * Find user by email
 */
const findUserByEmail = async (email) => {
  const sql = `
    SELECT id, email, password_hash, name, created_at
    FROM users
    WHERE email = $1;
  `;

  try {
    const result = await query(sql, [email]);
    return result.rows[0] || null;
  } catch (error) {
    throw error;
  }
};

/**
 * Find user by ID
 */
const findUserById = async (id) => {
  const sql = `
    SELECT id, email, name, created_at
    FROM users
    WHERE id = $1;
  `;

  try {
    const result = await query(sql, [id]);
    return result.rows[0] || null;
  } catch (error) {
    throw error;
  }
};

/**
 * Update user profile
 */
const updateUser = async (id, { name, email }) => {
  const sql = `
    UPDATE users
    SET name = COALESCE($2, name),
        email = COALESCE($3, email),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id, email, name, created_at;
  `;

  try {
    const result = await query(sql, [id, name, email]);
    return result.rows[0] || null;
  } catch (error) {
    throw error;
  }
};

/**
 * Delete user
 */
const deleteUser = async (id) => {
  const sql = `
    DELETE FROM users
    WHERE id = $1
    RETURNING id;
  `;

  try {
    const result = await query(sql, [id]);
    return result.rows[0] ? true : false;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  initializeUserTable,
  createUser,
  findUserByEmail,
  findUserById,
  updateUser,
  deleteUser,
};
