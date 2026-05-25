const { getDirectMessages, getChannelMessages, searchMessages, deleteMessage } = require("./service");
const { sendSuccess, sendError } = require("../gateway/response");

/**
 * GET /chat/messages/direct?userId=xxx&limit=50&skip=0
 * Get direct message history between two users
 */
const getDirectMessagesHandler = async (req, res) => {
  try {
    const { userId, limit = 50, skip = 0 } = req.query;
    const currentUserId = req.user.id;

    if (!userId) {
      return sendError(
        res,
        new Error("userId query parameter is required"),
        400
      );
    }

    const result = await getDirectMessages({
      userId1: currentUserId,
      userId2: userId,
      limit: parseInt(limit),
      skip: parseInt(skip),
    });

    if (!result.success) {
      return sendError(res, new Error(result.error), 500);
    }

    return sendSuccess(res, result.data, "Direct messages retrieved", 200);
  } catch (error) {
    console.error("getDirectMessages error:", error.message);
    return sendError(res, error, 500);
  }
};

/**
 * GET /chat/messages/channel/:channelId?limit=50&skip=0
 * Get channel message history
 */
const getChannelMessagesHandler = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { limit = 50, skip = 0 } = req.query;

    if (!channelId) {
      return sendError(
        res,
        new Error("channelId parameter is required"),
        400
      );
    }

    const result = await getChannelMessages({
      channel_id: channelId,
      limit: parseInt(limit),
      skip: parseInt(skip),
    });

    if (!result.success) {
      return sendError(res, new Error(result.error), 500);
    }

    return sendSuccess(res, result.data, "Channel messages retrieved", 200);
  } catch (error) {
    console.error("getChannelMessages error:", error.message);
    return sendError(res, error, 500);
  }
};

/**
 * GET /chat/search?query=xxx&limit=20
 * Search messages
 */
const searchMessagesHandler = async (req, res) => {
  try {
    const { query, limit = 20 } = req.query;
    const userId = req.user.id;

    if (!query) {
      return sendError(
        res,
        new Error("query parameter is required"),
        400
      );
    }

    const result = await searchMessages({
      query,
      userId,
      limit: parseInt(limit),
    });

    if (!result.success) {
      return sendError(res, new Error(result.error), 500);
    }

    return sendSuccess(res, result.data, "Search completed", 200);
  } catch (error) {
    console.error("searchMessages error:", error.message);
    return sendError(res, error, 500);
  }
};

/**
 * DELETE /chat/messages/:messageId
 * Delete a message (owner only)
 */
const deleteMessageHandler = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    if (!messageId) {
      return sendError(
        res,
        new Error("messageId parameter is required"),
        400
      );
    }

    const result = await deleteMessage({
      messageId,
      userId,
    });

    if (!result.success) {
      return sendError(res, new Error(result.error), 500);
    }

    return sendSuccess(res, result.data, "Message deleted", 200);
  } catch (error) {
    console.error("deleteMessage error:", error.message);
    return sendError(res, error, 500);
  }
};

module.exports = {
  getDirectMessagesHandler,
  getChannelMessagesHandler,
  searchMessagesHandler,
  deleteMessageHandler,
};
