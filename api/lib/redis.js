import { Redis } from '@upstash/redis';

const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

const KEY_EXPIRES = 'gitdeadline:expires:';
const KEY_RANKING = 'gitdeadline:ranking';
const KEY_LAST_COMMIT = 'gitdeadline:last_commit:';
const DEFAULT_HOURS = 24;
const SPAM_COOLDOWN = 3600;
const BONUS = { pr_merged: 72 * 3600, issue_resolved: 48 * 3600, commit: 3600 };

export function isRedisConfigured() {
  return !!redis;
}

export async function getTime(userId) {
  if (!redis) return { time: DEFAULT_HOURS * 3600 };
  const expiresAt = await redis.get(KEY_EXPIRES + userId);
  if (!expiresAt) return { time: null };
  const now = Math.floor(Date.now() / 1000);
  const time = Math.max(0, Number(expiresAt) - now);
  return { time };
}

export async function initUser(userId) {
  if (!redis) {
    const t = DEFAULT_HOURS * 3600;
    return { time: t };
  }
  const exists = await redis.get(KEY_EXPIRES + userId);
  if (exists) {
    const now = Math.floor(Date.now() / 1000);
    return { time: Math.max(0, Number(exists) - now) };
  }
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + DEFAULT_HOURS * 3600;
  await redis.set(KEY_EXPIRES + userId, expiresAt);
  await redis.zadd(KEY_RANKING, { score: expiresAt, member: userId });
  return { time: DEFAULT_HOURS * 3600 };
}

export async function addBonus(userId, event) {
  if (!redis) return { bonus: 0 };
  const bonus = BONUS[event] || BONUS.commit;
  if (event === 'commit') {
    const last = await redis.get(KEY_LAST_COMMIT + userId);
    if (last && Date.now() / 1000 - Number(last) < SPAM_COOLDOWN) {
      return { bonus: 0 };
    }
    await redis.set(KEY_LAST_COMMIT + userId, Math.floor(Date.now() / 1000), { ex: 86400 });
  }
  const key = KEY_EXPIRES + userId;
  let expiresAt = await redis.get(key);
  const now = Math.floor(Date.now() / 1000);
  if (!expiresAt) {
    expiresAt = now + DEFAULT_HOURS * 3600;
  } else {
    expiresAt = Math.max(now, Number(expiresAt)) + bonus;
  }
  await redis.set(key, expiresAt);
  await redis.zadd(KEY_RANKING, { score: expiresAt, member: userId });
  return { bonus };
}

export async function getRanking(limit = 50) {
  if (!redis) return { ranking: [] };
  const results = await redis.zrange(KEY_RANKING, 0, limit - 1, { rev: true, withScores: true });
  const now = Math.floor(Date.now() / 1000);
  const ranking = results.map((r, i) => ({
    user_id: r.member,
    score: Math.max(0, r.score - now),
    rank: i + 1,
  }));
  return { ranking };
}
