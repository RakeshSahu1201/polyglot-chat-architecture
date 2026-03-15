require("dotenv").config();

const express = require("express");
const { createServer } = require("node:http");
const cors = require("cors");
const { Server } = require("socket.io");
const { config } = require("./db/MongoConnection");
const redis = require("./db/RedisClient");
const { create_conversation } = require("./repository/Conversation");
const { get_users } = require("./repository/User");
const user_router = require("./router/User");
const conversation_router = require("./router/Conversation");

const app = express();
const server = createServer(app);

// DB connectivity
config();

app.use(express.json());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use("/media", express.static("media"));

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  },
});

// ---------------------------------------------------------------------------
// Redis helpers — online user presence
// ---------------------------------------------------------------------------

/**
 * Store a user's socket_id in Redis with a TTL.
 * Key: online:<userId>  Value: JSON { _id, name, socket_id }
 */
const setUserOnline = async (user, socket_id) => {
  const payload = JSON.stringify({ ...user, socket_id });
  await redis.set(`online:${user._id}`, payload, "EX", 86400); // 24h TTL
};

/**
 * Remove a user from the online set when they disconnect.
 * We look up by socket_id because "disconnect" doesn't carry the user object.
 */
const removeUserBySocketId = async (socket_id) => {
  const keys = await redis.keys("online:*");
  for (const key of keys) {
    const raw = await redis.get(key);
    if (!raw) continue;
    const user = JSON.parse(raw);
    if (user.socket_id === socket_id) {
      await redis.del(key);
      break;
    }
  }
};

/** Resolve a socket_id for a given userId from Redis. Returns null if offline. */
const getSocketId = async (userId) => {
  const raw = await redis.get(`online:${userId}`);
  if (!raw) return null;
  return JSON.parse(raw).socket_id;
};

/** Get all currently online users from Redis */
const getOnlineUsers = async () => {
  const keys = await redis.keys("online:*");
  const users = [];
  for (const key of keys) {
    const raw = await redis.get(key);
    if (raw) {
      users.push(JSON.parse(raw));
    }
  }
  return users;
};

// ---------------------------------------------------------------------------
// Socket.IO
// ---------------------------------------------------------------------------

io.on("connection", (socket) => {
  // ------- User presence -------

  socket.on("login_me", async ({ logged_user }) => {
    if (!logged_user) return;
    try {
      await setUserOnline(logged_user, socket.id);
      const connected_users = await getOnlineUsers();
      io.emit("get_connected_users", { connected_users });
    } catch (err) {
      console.error("login_me error:", err.message);
    }
  });

  socket.on("disconnect", async () => {
    try {
      await removeUserBySocketId(socket.id);
      const connected_users = await getOnlineUsers();
      io.emit("get_connected_users", { connected_users });
    } catch (err) {
      console.error("disconnect cleanup error:", err.message);
    }
  });

  // ------- Messaging -------

  socket.on("send_message", async ({ message }, callback) => {
    try {
      const { data, error } = await create_conversation({ message });
      if (error) {
        return callback({ error });
      }

      const fromSocketId = await getSocketId(message.from);
      const toSocketId = await getSocketId(message.to);

      const targets = [fromSocketId, toSocketId].filter(Boolean);
      if (targets.length > 0) {
        io.to(targets).emit("message_sent", { new_message: data });
      }

      callback({ data });
    } catch (err) {
      console.error("send_message error:", err.message);
      callback({ error: err.message });
    }
  });

  socket.on("send_media", async ({ media_message }) => {
    try {
      const fromSocketId = await getSocketId(media_message.from);
      const toSocketId = await getSocketId(media_message.to);

      const targets = [fromSocketId, toSocketId].filter(Boolean);
      if (targets.length > 0) {
        io.to(targets).emit("message_sent", { new_message: media_message });
      }
    } catch (err) {
      console.error("send_media error:", err.message);
    }
  });
});
// ---------------------------------------------------------------------------
// Redis Pub/Sub for Channel Events (from Go channel-service)
// ---------------------------------------------------------------------------

const redisSubscriber = redis.duplicate();

redisSubscriber.on("error", (err) => {
  console.error("Redis Subscriber Error:", err);
});

async function setupRedisSubscriber() {
  await redisSubscriber.connect();
  console.log("Redis Subscriber connected to relay channel events");

  // Subscribe to all channel events using pSubscribe
  await redisSubscriber.pSubscribe("channel:*", (message, channel) => {
    try {
      const event = JSON.parse(message);
      if (event.type === "channel_message") {
        const channelId = event.channelId;
        const msgData = event.message;

        // In a real app we'd query Go or Redis for the current online members of THIS channel.
        // For simplicity right now, we can just broadcast to ALL online users, and the React frontend 
        // will decide if it cares about this channel ID.
        // A better optimization later: io.to(`channel-room-${channelId}`).emit(...)
        io.emit("channel_message", { channelId, message: msgData });
      }
    } catch (err) {
      console.error("Redis channel message parse error:", err);
    }
  });
}

setupRedisSubscriber().catch(console.error);

// ---------------------------------------------------------------------------
// REST routes
// ---------------------------------------------------------------------------

app.use("/user", user_router);
app.use("/conversation", conversation_router);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`server up http://localhost:${PORT}`);
});
