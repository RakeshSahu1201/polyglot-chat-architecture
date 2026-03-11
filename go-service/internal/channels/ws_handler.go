package channels

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/polyglot-chat/go-service/pkg/db"
	"github.com/polyglot-chat/go-service/pkg/middleware"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // tighten in production
	},
}

// WsHandler upgrades HTTP → WebSocket for a specific channel.
// Auth via ?token= query parameter (header not available on WS upgrade in browsers).
// GET /ws/channels/:id?token=<jwt>
func WsHandler(c *gin.Context) {
	channelID := c.Param("id")
	tokenStr := c.Query("token")

	claims, err := middleware.WSAuth(tokenStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
		return
	}

	// Verify membership
	ok, err := IsMember(c.Request.Context(), channelID, claims.ID)
	if err != nil || !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "not a member of this channel"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("ws upgrade error: %v", err)
		return
	}

	hub := Manager.GetOrCreate(channelID)
	client := &Client{
		hub:      hub,
		userID:   claims.ID,
		userName: claims.Name,
		send:     make(chan []byte, 256),
	}

	// Store conn reference for writePump
	hub.mu.Lock()
	connStore[client] = conn
	hub.mu.Unlock()

	hub.register <- client

	go client.writePump()
	client.readPump(conn, channelID) // blocks until connection closes
}

// publishToRedis publishes a channel message to Redis Pub/Sub so Node.js can relay it.
func publishToRedis(channelID string, msg *Message) {
	data, err := json.Marshal(map[string]any{
		"type":      "channel_message",
		"channelId": channelID,
		"message":   msg,
	})
	if err != nil {
		log.Printf("publishToRedis marshal: %v", err)
		return
	}
	if err := db.Redis.Publish(context.Background(), "channel:"+channelID, data).Err(); err != nil {
		log.Printf("publishToRedis error: %v", err)
	}
}
