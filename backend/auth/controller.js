const { signup, login, getCurrentUser } = require("./service");
const { sendSuccess, sendError } = require("../gateway/response");

/**
 * POST /auth/signup
 * Register a new user
 */
const signupHandler = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return sendError(
        res,
        new Error("Email, password, and name are required"),
        400
      );
    }

    const result = await signup(email, password, name);
    return sendSuccess(res, result, "User registered successfully", 201);
  } catch (error) {
    console.error("Signup error:", error.message);
    const statusCode = error.message.includes("already") ? 409 : 400;
    return sendError(res, error, statusCode);
  }
};

/**
 * POST /auth/login
 * Authenticate a user
 */
const loginHandler = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(
        res,
        new Error("Email and password are required"),
        400
      );
    }

    const result = await login(email, password);
    return sendSuccess(res, result, "Login successful", 200);
  } catch (error) {
    console.error("Login error:", error.message);
    return sendError(res, error, 401);
  }
};

/**
 * GET /auth/me
 * Get current user (protected route)
 */
const getCurrentUserHandler = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return sendError(res, new Error("Unauthorized"), 401);
    }

    const user = await getCurrentUser(req.user.id);
    return sendSuccess(res, { user }, "User fetched successfully", 200);
  } catch (error) {
    console.error("Get current user error:", error.message);
    return sendError(res, error, 500);
  }
};

module.exports = {
  signupHandler,
  loginHandler,
  getCurrentUserHandler,
};
