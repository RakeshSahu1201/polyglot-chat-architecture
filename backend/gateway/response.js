/**
 * Standardized API response formatter
 */
const formatSuccess = (data, message = "Success", statusCode = 200) => {
  return {
    success: true,
    statusCode,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
};

const formatError = (error, statusCode = 500) => {
  return {
    success: false,
    statusCode,
    error: error instanceof Error ? error.message : String(error),
    timestamp: new Date().toISOString(),
  };
};

/**
 * Express response helpers
 */
const sendSuccess = (res, data, message = "Success", statusCode = 200) => {
  return res.status(statusCode).json(formatSuccess(data, message, statusCode));
};

const sendError = (res, error, statusCode = 500) => {
  return res.status(statusCode).json(formatError(error, statusCode));
};

module.exports = {
  formatSuccess,
  formatError,
  sendSuccess,
  sendError,
};
