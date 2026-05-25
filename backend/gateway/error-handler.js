const { formatError } = require("./response");

/**
 * Centralized error handler middleware
 * Should be registered as the last middleware in Express
 */
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  // Log error details
  console.error(`[${new Date().toISOString()}] Error:`, {
    statusCode,
    message,
    path: req.path,
    method: req.method,
    stack: err.stack,
  });

  // Don't expose internal error details in production
  const isDevelopment = process.env.NODE_ENV === "development";
  const errorResponse = formatError(
    isDevelopment ? err : new Error(message),
    statusCode
  );

  res.status(statusCode).json(errorResponse);
};

/**
 * Async wrapper for route handlers to catch Promise rejections
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  asyncHandler,
};
