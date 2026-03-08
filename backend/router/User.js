const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { create_user, get_user_by_name } = require("../repository/User");

const user_router = express.Router();

// POST /user/register-user
user_router.post("/register-user", async (req, res) => {
  try {
    const { name, password } = req.body;
    if (!name || !password) {
      return res.status(400).json({ error: "name and password are required" });
    }

    const { data, error } = await create_user({ name, password });
    if (error) {
      return res.status(400).json({ error });
    }

    const token = jwt.sign(
      { id: data._id, name: data.name },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      user: { _id: data._id, name: data.name },
      token,
    });
  } catch (error) {
    console.log("register_user_error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// POST /user/login-user
user_router.post("/login-user", async (req, res) => {
  try {
    const { name, password } = req.body;
    if (!name || !password) {
      return res.status(400).json({ error: "name and password are required" });
    }

    const { data, error } = await get_user_by_name({ name });
    if (error) {
      return res.status(500).json({ error });
    }
    if (!data) {
      return res.status(404).json({ error: "user not found" });
    }

    const passwordMatch = await bcrypt.compare(password, data.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "invalid password" });
    }

    const token = jwt.sign(
      { id: data._id, name: data.name },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      user: { _id: data._id, name: data.name },
      token,
    });
  } catch (error) {
    console.log("login_user_error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = user_router;
