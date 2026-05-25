const redis = require("../db/RedisClient");

/**
 * Set user as online with socket ID and channels
 */
const setUserOnline = async (userId, { name, socket_id, channels = [] }) => {
  try {
    const payload = JSON.stringify({
      userId,
      name,
      socket_id,
      channels,
      online_since: new Date().toISOString(),
    });
    // 24h TTL for online status
    await redis.set(`online:${userId}`, payload, "EX", 86400);
  } catch (error) {
    console.error("setUserOnline error:", error.message);
  }
};

/**
 * Remove user from online set
 */
const setUserOffline = async (userId) => {
  try {
    await redis.del(`online:${userId}`);
  } catch (error) {
    console.error("setUserOffline error:", error.message);
  }
};

/**
 * Get user by socket ID (for disconnect cleanup)
 */
const getUserBySocketId = async (socket_id) => {
  try {
    const keys = await redis.keys("online:*");
    for (const key of keys) {
      const raw = await redis.get(key);
      if (!raw) continue;
      const user = JSON.parse(raw);
      if (user.socket_id === socket_id) {
        return user;
      }
    }
    return null;
  } catch (error) {
    console.error("getUserBySocketId error:", error.message);
    return null;
  }
};

/**
 * Get all online users
 */
const getOnlineUsers = async () => {
  try {
    const keys = await redis.keys("online:*");
    const users = [];
    for (const key of keys) {
      const raw = await redis.get(key);
      if (raw) {
        users.push(JSON.parse(raw));
      }
    }
    return users;
  } catch (error) {
    console.error("getOnlineUsers error:", error.message);
    return [];
  }
};

/**
 * Get socket ID for a user (if online)
 */
const getSocketId = async (userId) => {
  try {
    const raw = await redis.get(`online:${userId}`);
    if (!raw) return null;
    return JSON.parse(raw).socket_id;
  } catch (error) {
    console.error("getSocketId error:", error.message);
    return null;
  }
};

/**
 * Get user by ID (if online)
 */
const getOnlineUser = async (userId) => {
  try {
    const raw = await redis.get(`online:${userId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.error("getOnlineUser error:", error.message);
    return null;
  }
};

/**
 * Update user channels
 */
const updateUserChannels = async (userId, channels) => {
  try {
    const raw = await redis.get(`online:${userId}`);
    if (!raw) return null;

    const user = JSON.parse(raw);
    user.channels = channels;

    const payload = JSON.stringify(user);
    await redis.set(`online:${userId}`, payload, "EX", 86400);

    return user;
  } catch (error) {
    console.error("updateUserChannels error:", error.message);
    return null;
  }
};

module.exports = {
  setUserOnline,
  setUserOffline,
  getUserBySocketId,
  getOnlineUsers,
  getSocketId,
  getOnlineUser,
  updateUserChannels,
};
