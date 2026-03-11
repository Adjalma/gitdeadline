package websocket

import (
	"encoding/json"
	"log"
	"sync"

	gorillaws "github.com/gorilla/websocket"
)

type Client struct {
	ID     string
	UserID string
	Send   chan []byte
	Hub    *Hub
}

func (c *Client) WritePump(conn *gorillaws.Conn) {
	defer func() {
		c.Hub.unregister <- c
		conn.Close()
	}()
	for msg := range c.Send {
		if err := conn.WriteMessage(gorillaws.TextMessage, msg); err != nil {
			return
		}
	}
}

func (c *Client) ReadPump(conn *gorillaws.Conn) {
	defer conn.Close()
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			return
		}
	}
}

type Hub struct {
	clients    map[string]map[*Client]bool // userID -> clients
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]map[*Client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case c := <-h.register:
			h.mu.Lock()
			if h.clients[c.UserID] == nil {
				h.clients[c.UserID] = make(map[*Client]bool)
			}
			h.clients[c.UserID][c] = true
			h.mu.Unlock()

		case c := <-h.unregister:
			h.mu.Lock()
			if m, ok := h.clients[c.UserID]; ok {
				delete(m, c)
				if len(m) == 0 {
					delete(h.clients, c.UserID)
				}
			}
			close(c.Send)
			h.mu.Unlock()

		case msg := <-h.broadcast:
			h.mu.RLock()
			for _, m := range h.clients {
				for c := range m {
					select {
					case c.Send <- msg:
					default:
						close(c.Send)
						delete(m, c)
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) BroadcastToUser(userID string, msg interface{}) {
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("ws marshal: %v", err)
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	if m, ok := h.clients[userID]; ok {
		for c := range m {
			select {
			case c.Send <- data:
			default:
				close(c.Send)
				delete(m, c)
			}
		}
	}
}

func (h *Hub) Register(c *Client) {
	h.register <- c
}

func (h *Hub) BroadcastAll(msg interface{}) {
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("ws marshal: %v", err)
		return
	}
	h.broadcast <- data
}
