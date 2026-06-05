require("dotenv").config();

const express = require("express");
const { createServer } = require("node:http");
const cors = require("cors");
const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");

// Database connections
const { config: mongoConfig } = require("./db/MongoConnection");
const redis = require("./db/RedisClient");

// Routes
const chatRoutes = require("./chat/routes");
const mediaRoutes = require("./media/routes");
const { setupSocketHandlers } = require("./chat/socket-handler");

// Gateway
const { setupMiddleware } = require("./gateway/middleware");
const { errorHandler } = require("./gateway/error-handler");

const app = express();
const server = createServer(app);

// Initialize databases
(async () => {
  try {
    // MongoDB for chat/media
    mongoConfig();
    console.log("✓ MongoDB initialized for chat service");
  } catch (error) {
    console.error("✗ Database initialization failed:", error);
    process.exit(1);
  }
})();

// Setup gateway middleware (CORS, body parser, logging, etc.)
setupMiddleware(app);

// Chat routes
app.use("/chat", chatRoutes);
app.use("/media", mediaRoutes);

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : "http://localhost",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Setup Redis Adapter for Socket.io (enables multi-instance scaling)
(async () => {
  try {
    const pubClient = redis.duplicate();
    const subClient = redis.duplicate();

    io.adapter(createAdapter(pubClient, subClient));
    console.log("✓ Redis adapter configured for Socket.io");

    // Setup Socket.io event handlers
    setupSocketHandlers(io, redis);
  } catch (error) {
    console.error("✗ Failed to setup Redis adapter:", error);
  }
})();

// ---------------------------------------------------------------------------
// Redis Pub/Sub for Channel Events (from Go channel-service)
// ---------------------------------------------------------------------------

const redisSubscriber = redis.duplicate();

redisSubscriber.on("error", (err) => {
  console.error("Redis Subscriber Error:", err);
});

async function setupRedisSubscriber() {
  try {
    console.log("✓ Redis Subscriber connected to relay channel events");

    await redisSubscriber.psubscribe("channel:*");
    redisSubscriber.on("pmessage", (pattern, channel, message) => {
      try {
        const event = JSON.parse(message);
        if (event.type === "channel_message") {
          const channelId = event.channelId;
          const msgData = event.message;

          // Broadcast channel messages to all connected clients
          // They'll filter by channelId on the frontend
          io.emit("channel_message", { channelId, message: msgData });
        }
      } catch (err) {
        console.error("Redis channel message parse error:", err);
      }
    });
  } catch (error) {
    console.error("Failed to setup Redis subscriber:", error);
  }
}

setupRedisSubscriber().catch(console.error);

// Setup error handler (must be last middleware)
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✓ Chat service listening on http://localhost:${PORT}`);
});
