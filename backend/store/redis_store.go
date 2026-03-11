package store

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/gitdeadline/backend/engine"
	"github.com/gitdeadline/backend/websocket"
)

const (
	KeyTimePrefix       = "gitdeadline:time:"
	KeyRanking          = "gitdeadline:ranking"
	KeyLastCommitPrefix = "gitdeadline:last_commit:"
	DefaultTimeSecs     = 24 * 3600 // 24h inicial para novos usuários
)

type RedisStore struct {
	client *redis.Client
}

func NewRedisStore(addr string) (*RedisStore, error) {
	client := redis.NewClient(&redis.Options{
		Addr: addr,
	})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, err
	}
	return &RedisStore{client: client}, nil
}

func (r *RedisStore) Exists(ctx context.Context, userID string) (bool, error) {
	n, err := r.client.Exists(ctx, KeyTimePrefix+userID).Result()
	return n > 0, err
}

func (r *RedisStore) GetTime(ctx context.Context, userID string) (int64, error) {
	val, err := r.client.Get(ctx, KeyTimePrefix+userID).Int64()
	if err == redis.Nil {
		return DefaultTimeSecs, nil
	}
	return val, err
}

func (r *RedisStore) SetTime(ctx context.Context, userID string, seconds int64) error {
	key := KeyTimePrefix + userID
	if err := r.client.Set(ctx, key, seconds, 0).Err(); err != nil {
		return err
	}
	return r.client.ZAdd(ctx, KeyRanking, redis.Z{Score: float64(seconds), Member: userID}).Err()
}

func (r *RedisStore) AddTime(ctx context.Context, userID string, seconds int64) error {
	current, err := r.GetTime(ctx, userID)
	if err != nil {
		return err
	}
	newTime := current + seconds
	return r.SetTime(ctx, userID, newTime)
}

func (r *RedisStore) SetRankScore(ctx context.Context, userID string, score float64) error {
	return r.client.ZAdd(ctx, KeyRanking, redis.Z{Score: score, Member: userID}).Err()
}

func (r *RedisStore) GetRanking(ctx context.Context, limit int) ([]engine.RankEntry, error) {
	if limit <= 0 {
		limit = 100
	}
	results, err := r.client.ZRevRangeWithScores(ctx, KeyRanking, 0, int64(limit-1)).Result()
	if err != nil {
		return nil, err
	}
	entries := make([]engine.RankEntry, len(results))
	for i, z := range results {
		userID, _ := z.Member.(string)
		entries[i] = engine.RankEntry{
			UserID: userID,
			Score:  z.Score,
			Rank:   i + 1,
		}
	}
	return entries, nil
}

func (r *RedisStore) GetLastCommitTime(ctx context.Context, userID string) (int64, error) {
	val, err := r.client.Get(ctx, KeyLastCommitPrefix+userID).Int64()
	if err == redis.Nil {
		return 0, nil
	}
	return val, err
}

func (r *RedisStore) SetLastCommitTime(ctx context.Context, userID string, unix int64) error {
	return r.client.Set(ctx, KeyLastCommitPrefix+userID, unix, 24*time.Hour).Err()
}

// DecrementAll decrementa 1 segundo do tempo de cada usuário no ranking e notifica via WebSocket
func (r *RedisStore) DecrementAll(ctx context.Context, hub *websocket.Hub) {
	members, err := r.client.ZRevRange(ctx, KeyRanking, 0, 9999).Result()
	if err != nil {
		return
	}
	for _, userID := range members {
		key := KeyTimePrefix + userID
		val, err := r.client.Decr(ctx, key).Result()
		if err != nil {
			continue
		}
		if val < 0 {
			val = 0
			r.client.Set(ctx, key, 0, 0)
		}
		r.client.ZAdd(ctx, KeyRanking, redis.Z{Score: float64(val), Member: userID})
		hub.BroadcastToUser(userID, map[string]interface{}{
			"type": "time_update",
			"time": val,
		})
	}
}

// SyncTimesFromZSet - o tempo real é armazenado em strings, o ranking em ZSET
// Precisamos decrementar ambos. Para simplicidade, o tempo é a fonte da verdade.
func (r *RedisStore) SyncTimeToRanking(ctx context.Context, userID string) error {
	t, err := r.GetTime(ctx, userID)
	if err != nil {
		return err
	}
	return r.SetRankScore(ctx, userID, float64(t))
}
