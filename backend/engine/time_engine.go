package engine

import (
	"context"
	"log"
	"sync"
	"time"
)

const (
	// Recompensas em segundos
	PRMergedBonus    = 72 * 3600  // 72 horas
	IssueResolved    = 48 * 3600  // 48 horas
	CommitSimple     = 1 * 3600   // 1 hora (com trava anti-spam)
	SpamCooldownSecs = 3600       // 1 hora entre commits
)

type TimeStore interface {
	GetTime(ctx context.Context, userID string) (int64, error)
	SetTime(ctx context.Context, userID string, seconds int64) error
	AddTime(ctx context.Context, userID string, seconds int64) error
	GetRanking(ctx context.Context, limit int) ([]RankEntry, error)
	SetRankScore(ctx context.Context, userID string, score float64) error
	GetLastCommitTime(ctx context.Context, userID string) (int64, error)
	SetLastCommitTime(ctx context.Context, userID string, unix int64) error
}

type RankEntry struct {
	UserID string  `json:"user_id"`
	Score  float64 `json:"score"`
	Rank   int     `json:"rank"`
}

// TimeEngine gerencia o Relógio de Vida - decrementa 1 segundo por segundo real
type TimeEngine struct {
	store TimeStore
	mu    sync.RWMutex
	tickers map[string]*time.Ticker
	stopCh chan struct{}
}

func NewTimeEngine(store TimeStore) *TimeEngine {
	return &TimeEngine{
		store:   store,
		tickers: make(map[string]*time.Ticker),
		stopCh:  make(chan struct{}),
	}
}

// DecrementLoop executa a cada segundo para todos os usuários ativos
func (e *TimeEngine) DecrementLoop(ctx context.Context) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-e.stopCh:
			return
		case <-ticker.C:
			// O decremento é feito no Redis via score update
			// Esta goroutine pode disparar broadcast para WebSockets
			_ = ticker
		}
	}
}

// GetTime retorna o tempo restante do usuário em segundos
func (e *TimeEngine) GetTime(ctx context.Context, userID string) (int64, error) {
	return e.store.GetTime(ctx, userID)
}

// AddTime adiciona segundos ao relógio do usuário
func (e *TimeEngine) AddTime(ctx context.Context, userID string, seconds int64) error {
	return e.store.AddTime(ctx, userID, seconds)
}

// ProcessEvent processa evento do GitHub e concede tempo (implementa EventProcessor)
func (e *TimeEngine) ProcessEvent(ctx context.Context, userID string, eventType string, metadata map[string]interface{}) (int64, error) {
	var bonus int64
	switch eventType {
	case "pr_merged":
		bonus = PRMergedBonus
	case "issue_resolved":
		bonus = IssueResolved
	case "commit":
		// Verifica cooldown anti-spam
		lastCommit, err := e.store.GetLastCommitTime(ctx, userID)
		if err == nil && time.Now().Unix()-lastCommit < SpamCooldownSecs {
			return 0, nil // Ignora commit por spam
		}
		bonus = CommitSimple
		if err := e.store.SetLastCommitTime(ctx, userID, time.Now().Unix()); err != nil {
			log.Printf("Erro ao salvar last commit: %v", err)
		}
	default:
		return 0, nil
	}

	if err := e.store.AddTime(ctx, userID, bonus); err != nil {
		return 0, err
	}
	return bonus, nil
}

// GetRanking retorna o ranking de longevidade
func (e *TimeEngine) GetRanking(ctx context.Context, limit int) ([]RankEntry, error) {
	return e.store.GetRanking(ctx, limit)
}
