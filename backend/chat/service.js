const { conversation } = require("../model/Conversation");

/**
 * Save a message to MongoDB
 */
const saveMessage = async ({ from, to, body, media_url = "", thumbnail_url = "", message_type = "dm", channel_id = null }) => {
  try {
    const isChannelMessage = message_type === "channel" || Boolean(channel_id);

    if (!from) {
      throw new Error("from is required");
    }

    if (!isChannelMessage && !to) {
      throw new Error("to is required for direct messages");
    }

    if (!body && !media_url) {
      throw new Error("body or media_url is required");
    }

    const messageData = {
      from,
      to: isChannelMessage ? to || channel_id || "channel" : to,
      body,
      media_url,
      thumbnail_url,
      message_type, // "dm" or "channel"
      channel_id, // null for DMs, UUID for channel messages
    };

    const newMessage = new conversation(messageData);
    const result = await newMessage.save();

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("saveMessage error:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Get messages between two users (DM history)
 */
const getDirectMessages = async ({ userId1, userId2, limit = 50, skip = 0 }) => {
  try {
    const messages = await conversation
      .find({
        message_type: "dm",
        $or: [
          { from: userId1, to: userId2 },
          { from: userId2, to: userId1 },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .exec();

    return {
      success: true,
      data: messages.reverse(), // Reverse to get chronological order
    };
  } catch (error) {
    console.error("getDirectMessages error:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Get messages in a channel
 */
const getChannelMessages = async ({ channel_id, limit = 50, skip = 0 }) => {
  try {
    const messages = await conversation
      .find({
        message_type: "channel",
        channel_id,
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .exec();

    return {
      success: true,
      data: messages.reverse(),
    };
  } catch (error) {
    console.error("getChannelMessages error:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Search messages
 */
const searchMessages = async ({ query, userId, limit = 20 }) => {
  try {
    const messages = await conversation
      .find({
        $text: { $search: query },
        $or: [{ from: userId }, { to: userId }],
      })
      .limit(limit)
      .exec();

    return {
      success: true,
      data: messages,
    };
  } catch (error) {
    console.error("searchMessages error:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Delete a message
 */
const deleteMessage = async ({ messageId, userId }) => {
  try {
    const message = await conversation.findByIdAndDelete(messageId);

    if (!message) {
      throw new Error("Message not found");
    }

    return {
      success: true,
      data: { id: messageId },
    };
  } catch (error) {
    console.error("deleteMessage error:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  saveMessage,
  getDirectMessages,
  getChannelMessages,
  searchMessages,
  deleteMessage,
};
