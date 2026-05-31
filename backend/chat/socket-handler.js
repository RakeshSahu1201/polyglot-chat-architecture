const { saveMessage } = require("./service");
const { setUserOnline, setUserOffline, getUserBySocketId, getSocketId, getOnlineUsers } = require("./presence");

/**
 * Setup all Socket.io event handlers
 */
const setupSocketHandlers = (io, redis) => {
  io.on("connection", (socket) => {
    console.log(`✓ Socket connected: ${socket.id}`);

    // =========================================================================
    // PRESENCE EVENTS
    // =========================================================================

    /**
     * login_me: User connects, set them online
     */
    socket.on("login_me", async ({ user }) => {
      try {
        if (!user || !user.id) {
          return socket.emit("error", { message: "Invalid user data" });
        }

        await setUserOnline(user.id, {
          name: user.name,
          socket_id: socket.id,
          channels: [],
        });

        const onlineUsers = await getOnlineUsers();
        io.emit("get_connected_users", { connected_users: onlineUsers });

        console.log(`✓ User logged in: ${user.id} (${user.name})`);
      } catch (error) {
        console.error("login_me error:", error.message);
        socket.emit("error", { message: error.message });
      }
    });

    /**
     * join_channel: User joins a channel room
     */
    socket.on("join_channel", async ({ userId, channelId }) => {
      try {
        socket.join(`channel:${channelId}`);
        const roomSize = io.sockets.adapter.rooms.get(`channel:${channelId}`).size;
        io.to(`channel:${channelId}`).emit("user_joined_channel", {
          channelId,
          roomSize,
        });
        console.log(`✓ User ${userId} joined channel ${channelId}`);
      } catch (error) {
        console.error("join_channel error:", error.message);
      }
    });

    /**
     * leave_channel: User leaves a channel room
     */
    socket.on("leave_channel", async ({ userId, channelId }) => {
      try {
        socket.leave(`channel:${channelId}`);
        const room = io.sockets.adapter.rooms.get(`channel:${channelId}`);
        const roomSize = room ? room.size : 0;
        io.to(`channel:${channelId}`).emit("user_left_channel", {
          channelId,
          roomSize,
        });
        console.log(`✓ User ${userId} left channel ${channelId}`);
      } catch (error) {
        console.error("leave_channel error:", error.message);
      }
    });

    // =========================================================================
    // MESSAGING EVENTS
    // =========================================================================

    /**
     * send_message: Handle direct messages or channel messages
     */
    socket.on("send_message", async ({ message }, callback) => {
      try {
        if (!message || !message.from || (!message.body && !message.media_url)) {
          return callback({ success: false, error: "Invalid message data" });
        }

        // Save to MongoDB
        const result = await saveMessage({
          from: message.from,
          to: message.to || null,
          body: message.body,
          media_url: message.media_url || "",
          thumbnail_url: message.thumbnail_url || "",
          message_type: message.channel_id ? "channel" : "dm",
          channel_id: message.channel_id || null,
        });

        if (!result.success) {
          return callback(result);
        }

        const savedMessage = result.data;

        // Route message to recipients
        if (message.channel_id) {
          // Channel message - broadcast to channel room
          io.to(`channel:${message.channel_id}`).emit("message_sent", {
            success: true,
            new_message: savedMessage,
          });
        } else {
          // DM - send to both users
          const toSocketId = await getSocketId(message.to);
          const fromSocketId = await getSocketId(message.from);

          const targets = [toSocketId, fromSocketId].filter(Boolean);
          if (targets.length > 0) {
            io.to(targets).emit("message_sent", {
              success: true,
              new_message: savedMessage,
            });
          }
        }

        callback({ success: true, data: savedMessage });
      } catch (error) {
        console.error("send_message error:", error.message);
        callback({ success: false, error: error.message });
      }
    });

    /**
     * typing: User is typing indicator
     */
    socket.on("typing", async ({ from, to, channelId }) => {
      try {
        if (channelId) {
          io.to(`channel:${channelId}`).emit("user_typing", { from, channelId });
        } else {
          const toSocketId = await getSocketId(to);
          if (toSocketId) {
            io.to(toSocketId).emit("user_typing", { from, to });
          }
        }
      } catch (error) {
        console.error("typing error:", error.message);
      }
    });

    // =========================================================================
    // DISCONNECT EVENT
    // =========================================================================

    socket.on("disconnect", async () => {
      try {
        const user = await getUserBySocketId(socket.id);
        if (user) {
          await setUserOffline(user.userId);
          const onlineUsers = await getOnlineUsers();
          io.emit("get_connected_users", { connected_users: onlineUsers });
          console.log(`✓ User disconnected: ${user.userId} (${user.name})`);
        }
      } catch (error) {
        console.error("disconnect cleanup error:", error.message);
      }
    });
  });
};

module.exports = { setupSocketHandlers };
