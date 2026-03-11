package channels

import (
	"encoding/json"
	"log"
	"sync"
)

// Client represents a single WebSocket connection to a channel.
type Client struct {
	hub      *Hub
	userID   string
	userName string
	send     chan []byte
}

// Hub maintains the set of active clients for a single channel and
// broadcasts messages to them. One goroutine per hub.
type Hub struct {
	channelID  string
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

// HubManager holds all active hubs, keyed by channelID.
type HubManager struct {
	mu   sync.RWMutex
	hubs map[string]*Hub
}

var Manager = &HubManager{hubs: make(map[string]*Hub)}

func (m *HubManager) GetOrCreate(channelID string) *Hub {
	m.mu.Lock()
	defer m.mu.Unlock()
	if h, ok := m.hubs[channelID]; ok {
		return h
	}
	h := &Hub{
		channelID:  channelID,
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
	m.hubs[channelID] = h
	go h.run()
	return h
}

// run is the hub's main goroutine — the only place clients map is mutated.
func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true

		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}

		case msg := <-h.broadcast:
			for client := range h.clients {
				select {
				case client.send <- msg:
				default:
					// slow client — drop and disconnect
					close(client.send)
					delete(h.clients, client)
				}
			}
		}
	}
}

// Broadcast sends a pre-marshalled JSON message to all connected clients.
func (h *Hub) Broadcast(msg []byte) {
	h.broadcast <- msg
}

// BroadcastEvent wraps a payload in a typed envelope and broadcasts it.
func (h *Hub) BroadcastEvent(eventType string, payload any) {
	envelope := map[string]any{"type": eventType, "payload": payload}
	data, err := json.Marshal(envelope)
	if err != nil {
		log.Printf("hub BroadcastEvent marshal: %v", err)
		return
	}
	h.broadcast <- data
}
