import { Redis } from '@upstash/redis';

const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

const KEY_EXPIRES = 'gitdeadline:expires:';
const KEY_RANKING = 'gitdeadline:ranking';
const KEY_ONLINE = 'gitdeadline:online';
const KEY_GH_TOKEN = 'gitdeadline:gh_token:';
const TOKEN_TTL = 2592000;
const ONLINE_TTL = 120; // 2 min
const KEY_LAST_COMMIT = 'gitdeadline:last_commit:';
const DEFAULT_HOURS = 24;
const SPAM_COOLDOWN = 3600;
const BONUS = { pr_merged: 72 * 3600, issue_resolved: 48 * 3600, commit: 3600 };

export function isRedisConfigured() {
  return !!redis;
}

export async function setGitHubToken(userId, token) {
  if (!redis || !token) return;
  await redis.set(KEY_GH_TOKEN + userId.toLowerCase(), token, { ex: TOKEN_TTL });
}

export async function getGitHubToken(userId) {
  if (!redis || !userId) return null;
  return redis.get(KEY_GH_TOKEN + userId.toLowerCase());
}

export async function getTime(userId) {
  if (!redis) return { time: null };
  const expiresAt = await redis.get(KEY_EXPIRES + userId);
  if (!expiresAt) return { time: null };
  const now = Math.floor(Date.now() / 1000);
  const time = Math.max(0, Number(expiresAt) - now);
  return { time };
}

export async function recordPresence(userId) {
  if (!redis) return;
  const now = Math.floor(Date.now() / 1000);
  await redis.zadd(KEY_ONLINE, { score: now, member: userId });
  await redis.zremrangebyscore(KEY_ONLINE, 0, now - ONLINE_TTL);
}

export async function getOnlineUsers() {
  if (!redis) return new Set();
  const now = Math.floor(Date.now() / 1000);
  const members = await redis.zrangebyscore(KEY_ONLINE, now - ONLINE_TTL, '+inf');
  return new Set(members);
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
  const expiresAt = await redis.get(key);
  if (!expiresAt) return { bonus: 0 };
  const now = Math.floor(Date.now() / 1000);
  const newExpires = Math.max(now, Number(expiresAt)) + bonus;
  await redis.set(key, newExpires);
  await redis.zadd(KEY_RANKING, { score: newExpires, member: userId });
  return { bonus };
}

export async function transferTime(fromUserId, toUserId, seconds) {
  if (!redis) return { ok: false };
  const fromKey = KEY_EXPIRES + fromUserId;
  const toKey = KEY_EXPIRES + toUserId;
  const fromExp = await redis.get(fromKey);
  const toExp = await redis.get(toKey);
  if (!fromExp) return { ok: false, error: 'sem tempo' };
  const now = Math.floor(Date.now() / 1000);
  const fromTime = Math.max(0, Number(fromExp) - now);
  if (fromTime < seconds) return { ok: false, error: 'tempo insuficiente' };
  const newFromExp = Number(fromExp) - seconds;
  const newToExp = toExp ? Number(toExp) + seconds : now + seconds;
  await redis.set(fromKey, newFromExp);
  await redis.set(toKey, newToExp);
  await redis.zadd(KEY_RANKING, { score: newFromExp, member: fromUserId });
  await redis.zadd(KEY_RANKING, { score: newToExp, member: toUserId });
  return { ok: true, transferred: seconds };
}

export async function syncFromHistory(userId, computedSeconds) {
  if (!redis) return { ok: false, error: 'Redis não configurado' };
  const now = Math.floor(Date.now() / 1000);
  const existing = await redis.get(KEY_EXPIRES + userId);
  let expiresAt;
  if (existing) {
    const currentRemaining = Math.max(0, Number(existing) - now);
    expiresAt = now + Math.max(computedSeconds, currentRemaining);
  } else {
    expiresAt = now + Math.max(computedSeconds, 3600);
  }
  await redis.set(KEY_EXPIRES + userId, expiresAt);
  await redis.zadd(KEY_RANKING, { score: expiresAt, member: userId });
  return { ok: true, time: Math.max(0, expiresAt - now) };
}

function parseZRangeWithScores(arr) {
  const out = [];
  for (let i = 0; i < arr.length; i += 2) {
    out.push({ member: arr[i], score: Number(arr[i + 1] ?? 0) });
  }
  return out;
}

export async function getAllUsersForMap(limit = 500) {
  if (!redis) return { users: [], online: [] };
  const [rawResults, onlineSet] = await Promise.all([
    redis.zrange(KEY_RANKING, 0, limit - 1, { rev: true, withScores: true }),
    getOnlineUsers(),
  ]);
  const results = Array.isArray(rawResults) && rawResults.length > 0
    ? (typeof rawResults[0] === 'object' && 'member' in rawResults[0]
        ? rawResults
        : parseZRangeWithScores(rawResults))
    : [];
  const now = Math.floor(Date.now() / 1000);
  const users = results.map((r, i) => ({
    user_id: r.member ?? r[0],
    score: Math.max(0, (r.score ?? r[1] ?? 0) - now),
    rank: i + 1,
    online: onlineSet.has(r.member ?? r[0]),
  }));
  return {
    users,
    online: [...onlineSet],
  };
}

export async function getRanking(limit = 50) {
  if (!redis) return { ranking: [] };
  const raw = await redis.zrange(KEY_RANKING, 0, limit - 1, { rev: true, withScores: true });
  const results = Array.isArray(raw) && raw.length > 0
    ? (typeof raw[0] === 'object' && 'member' in raw[0] ? raw : parseZRangeWithScores(raw))
    : [];
  const now = Math.floor(Date.now() / 1000);
  const ranking = results.map((r, i) => ({
    user_id: r.member ?? r[0],
    score: Math.max(0, (r.score ?? r[1] ?? 0) - now),
    rank: i + 1,
  }));
  return { ranking };
}
