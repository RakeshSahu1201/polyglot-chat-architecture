package channels

import (
	"context"
	"log"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 4096
)

// writePump pushes messages from the hub's send channel to the WebSocket.
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
	}()

	conn := c.hub.getConn(c)
	if conn == nil {
		return
	}

	for {
		select {
		case msg, ok := <-c.send:
			conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}

		case <-ticker.C:
			conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// readPump reads incoming messages from the WebSocket and dispatches them.
func (c *Client) readPump(conn *websocket.Conn, channelID string) {
	defer func() {
		c.hub.unregister <- c
		conn.Close()
	}()

	conn.SetReadLimit(maxMessageSize)
	conn.SetReadDeadline(time.Now().Add(pongWait))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	type incomingMsg struct {
		Body string `json:"body"`
	}

	for {
		var incoming incomingMsg
		if err := conn.ReadJSON(&incoming); err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("ws readPump error: %v", err)
			}
			break
		}

		if incoming.Body == "" {
			continue
		}

		// Save to Postgres
		msg, err := SaveMessage(context.Background(), channelID, c.userID, c.userName, incoming.Body)
		if err != nil {
			log.Printf("SaveMessage error: %v", err)
			continue
		}

		// Broadcast to hub
		c.hub.BroadcastEvent("message", msg)

		// Also publish to Redis Pub/Sub for Node.js relay
		publishToRedis(channelID, msg)
	}
}

// connStore maps *Client → *websocket.Conn (needed because Client doesn't hold it directly)
// to keep the hub clean. We use a simple package-level map protected by the hub's own goroutine.
var connStore = make(map[*Client]*websocket.Conn)

func (h *Hub) getConn(c *Client) *websocket.Conn {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return connStore[c]
}
