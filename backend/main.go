package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	gorillaws "github.com/gorilla/websocket"
	"github.com/gitdeadline/backend/config"
	"github.com/gitdeadline/backend/engine"
	"github.com/gitdeadline/backend/store"
	"github.com/gitdeadline/backend/webhook"
	"github.com/gitdeadline/backend/websocket"
)

var upgrader = gorillaws.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func main() {
	cfg := config.Load()
	rs, err := store.NewRedisStore(cfg.GetRedisAddr())
	if err != nil {
		log.Fatalf("Redis: %v", err)
	}

	te := engine.NewTimeEngine(rs)
	hub := websocket.NewHub()
	go hub.Run()

	// Decrementa o tempo de todos a cada segundo (via worker)
	go runDecrementWorker(context.Background(), rs, hub)

	mux := http.NewServeMux()

	// API REST
	mux.HandleFunc("GET /api/time/{user}", handleGetTime(te))
	mux.HandleFunc("GET /api/ranking", handleGetRanking(te))
	mux.HandleFunc("POST /api/user/{user}/init", handleInitUser(rs))
	mux.HandleFunc("POST /api/user/{user}/bonus", handleAddBonus(te)) // Debug: simula PR/commit
	mux.HandleFunc("GET /api/ws", handleWS(hub, te))

	// Webhook GitHub
	mux.HandleFunc("POST /api/webhook/github", webhook.HandleGitHubWebhook(te, cfg.GetGitHubSecret()))

	// Static files: procura frontend/build relativo ao executável ou CWD
	staticDir := os.Getenv("STATIC_DIR")
	if staticDir == "" {
		staticDir = "../frontend/build"
	}
	mux.Handle("/", http.FileServer(http.Dir(staticDir)))

	addr := ":" + cfg.GetServerPort()
	log.Printf("GITdeadline rodando em http://localhost%s", addr)
	log.Fatal(http.ListenAndServe(addr, corsMiddleware(mux)))
}

func runDecrementWorker(ctx context.Context, rs *store.RedisStore, hub *websocket.Hub) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			rs.DecrementAll(ctx, hub)
		}
	}
}

func handleGetTime(te *engine.TimeEngine) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := r.PathValue("user")
		if user == "" {
			http.Error(w, "user required", 400)
			return
		}
		secs, err := te.GetTime(r.Context(), user)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		json.NewEncoder(w).Encode(map[string]int64{"time": secs})
	}
}

func handleGetRanking(te *engine.TimeEngine) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		entries, err := te.GetRanking(r.Context(), 50)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		json.NewEncoder(w).Encode(map[string]interface{}{"ranking": entries})
	}
}

func handleInitUser(rs *store.RedisStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := r.PathValue("user")
		if user == "" {
			http.Error(w, "user required", 400)
			return
		}
		ctx := r.Context()
		t, _ := rs.GetTime(ctx, user)
		// Só persiste se não existir (GetTime retorna default quando key não existe)
		exists, _ := rs.Exists(ctx, user)
		if !exists {
			rs.SetTime(ctx, user, 24*3600)
			t = 24 * 3600
		}
		json.NewEncoder(w).Encode(map[string]int64{"time": t})
	}
}

func handleAddBonus(te *engine.TimeEngine) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := r.PathValue("user")
		if user == "" {
			http.Error(w, "user required", 400)
			return
		}
		event := r.URL.Query().Get("event") // pr_merged, issue_resolved, commit
		if event == "" {
			event = "commit"
		}
		bonus, err := te.ProcessEvent(r.Context(), user, event, nil)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		json.NewEncoder(w).Encode(map[string]interface{}{
			"ok": true, "bonus": bonus, "event": event,
		})
	}
}

func handleWS(hub *websocket.Hub, te *engine.TimeEngine) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.URL.Query().Get("user")
		if userID == "" {
			userID = "anonymous"
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}

		client := &websocket.Client{
			ID:     r.RemoteAddr,
			UserID: userID,
			Send:   make(chan []byte, 256),
			Hub:    hub,
		}
		hub.Register(client)
		go client.WritePump(conn)
		go client.ReadPump(conn)

		// Envia tempo inicial
		secs, _ := te.GetTime(r.Context(), userID)
		client.Send <- mustMarshal(map[string]interface{}{
			"type": "time_update",
			"time": secs,
		})
	}
}

func mustMarshal(v interface{}) []byte {
	b, _ := json.Marshal(v)
	return b
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(204)
			return
		}
		next.ServeHTTP(w, r)
	})
}
