const express = require("express");
const cors = require("cors");

/**
 * Request logger middleware
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Log response when it finishes
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
    );
  });

  next();
};

/**
 * Setup all middleware
 */
const setupMiddleware = (app) => {
  // Body parser
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // CORS
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || "http://localhost",
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  // Request logging
  app.use(requestLogger);

  // Health check (no logging)
  app.get("/health", (req, res) => {
    res.status(200).json({
      success: true,
      message: "Chat service is running",
      timestamp: new Date().toISOString(),
    });
  });

  return app;
};

module.exports = {
  requestLogger,
  setupMiddleware,
};
