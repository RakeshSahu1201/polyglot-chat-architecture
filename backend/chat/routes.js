const express = require("express");
const auth = require("../middleware/auth");
const {
  getDirectMessagesHandler,
  getChannelMessagesHandler,
  searchMessagesHandler,
  deleteMessageHandler,
} = require("./controller");

const router = express.Router();

/**
 * GET /chat/messages/direct?userId=xxx&limit=50
 * Get direct message history (protected)
 */
router.get("/messages/direct", auth, getDirectMessagesHandler);

/**
 * GET /chat/messages/channel/:channelId?limit=50
 * Get channel message history (protected)
 */
router.get("/messages/channel/:channelId", auth, getChannelMessagesHandler);

/**
 * GET /chat/search?query=xxx
 * Search messages (protected)
 */
router.get("/search", auth, searchMessagesHandler);

/**
 * DELETE /chat/messages/:messageId
 * Delete a message (protected)
 */
router.delete("/messages/:messageId", auth, deleteMessageHandler);

module.exports = router;
