const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createUser, findUserByEmail, findUserById } = require("./model");

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_key_123";
const JWT_EXPIRE = process.env.JWT_EXPIRE || "24h";

/**
 * Hash a password
 */
const hashPassword = async (password) => {
  const salt = await bcryptjs.genSalt(10);
  return bcryptjs.hash(password, salt);
};

/**
 * Compare password with hash
 */
const comparePassword = async (password, hash) => {
  return bcryptjs.compare(password, hash);
};

/**
 * Generate JWT token
 */
const generateToken = (userId, email, name) => {
  const payload = { id: userId, email, name };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRE });
};

/**
 * Verify JWT token
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
};

/**
 * Sign up a new user
 */
const signup = async (email, password, name) => {
  // Validate inputs
  if (!email || !password || !name) {
    throw new Error("Email, password, and name are required");
  }

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters long");
  }

  // Check if user exists
  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    throw new Error("Email already registered");
  }

  // Hash password and create user
  const passwordHash = await hashPassword(password);
  const user = await createUser(email, passwordHash, name);

  // Generate token
  const token = generateToken(user.id, user.email, user.name);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      created_at: user.created_at,
    },
  };
};

/**
 * Log in an existing user
 */
const login = async (email, password) => {
  // Validate inputs
  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  // Find user
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error("Invalid email or password");
  }

  // Verify password
  const isPasswordValid = await comparePassword(password, user.password_hash);
  if (!isPasswordValid) {
    throw new Error("Invalid email or password");
  }

  // Generate token
  const token = generateToken(user.id, user.email, user.name);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      created_at: user.created_at,
    },
  };
};

/**
 * Get current user (from token)
 */
const getCurrentUser = async (userId) => {
  const user = await findUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }
  return user;
};

module.exports = {
  signup,
  login,
  getCurrentUser,
  generateToken,
  verifyToken,
  comparePassword,
  hashPassword,
};
