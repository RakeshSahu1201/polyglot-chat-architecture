const express = require("express");
const auth = require("../middleware/auth");
const { signupHandler, loginHandler, getCurrentUserHandler } = require("./controller");

const router = express.Router();

/**
 * POST /auth/signup
 * Register a new user
 */
router.post("/signup", signupHandler);

/**
 * POST /auth/login
 * Authenticate a user
 */
router.post("/login", loginHandler);

/**
 * GET /auth/me
 * Get current user (protected)
 */
router.get("/me", auth, getCurrentUserHandler);

module.exports = router;
