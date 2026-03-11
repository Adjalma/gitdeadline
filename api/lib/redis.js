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
  const key = String(userId || '').toLowerCase();
  const expiresAt = await redis.get(KEY_EXPIRES + key);
  if (!expiresAt) return { time: null };
  const now = Math.floor(Date.now() / 1000);
  const time = Math.max(0, Number(expiresAt) - now);
  return { time };
}

export async function recordPresence(userId) {
  if (!redis || !userId) return;
  const key = String(userId).toLowerCase();
  const now = Math.floor(Date.now() / 1000);
  await redis.zadd(KEY_ONLINE, { score: now, member: key });
  await redis.zremrangebyscore(KEY_ONLINE, 0, now - ONLINE_TTL);
}

export async function getOnlineUsers() {
  if (!redis) return new Set();
  const now = Math.floor(Date.now() / 1000);
  const members = await redis.zrange(KEY_ONLINE, now - ONLINE_TTL, '+inf', { byScore: true });
  return new Set((Array.isArray(members) ? members : []).map((m) => String(m).toLowerCase()));
}

export async function initUser(userId) {
  if (!redis) {
    const t = DEFAULT_HOURS * 3600;
    return { time: t };
  }
  const key = String(userId || '').toLowerCase();
  const exists = await redis.get(KEY_EXPIRES + key);
  if (exists) {
    const now = Math.floor(Date.now() / 1000);
    return { time: Math.max(0, Number(exists) - now) };
  }
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + DEFAULT_HOURS * 3600;
  await redis.set(KEY_EXPIRES + key, expiresAt);
  await redis.zadd(KEY_RANKING, { score: expiresAt, member: key });
  return { time: DEFAULT_HOURS * 3600 };
}

export async function addBonus(userId, event) {
  if (!redis) return { bonus: 0 };
  const bonus = BONUS[event] || BONUS.commit;
  if (event === 'commit') {
    const ckey = String(userId || '').toLowerCase();
    const last = await redis.get(KEY_LAST_COMMIT + ckey);
    if (last && Date.now() / 1000 - Number(last) < SPAM_COOLDOWN) {
      return { bonus: 0 };
    }
    await redis.set(KEY_LAST_COMMIT + ckey, Math.floor(Date.now() / 1000), { ex: 86400 });
  }
  const key = String(userId || '').toLowerCase();
  const expKey = KEY_EXPIRES + key;
  const expiresAt = await redis.get(expKey);
  if (!expiresAt) return { bonus: 0 };
  const now = Math.floor(Date.now() / 1000);
  const newExpires = Math.max(now, Number(expiresAt)) + bonus;
  await redis.set(expKey, newExpires);
  await redis.zadd(KEY_RANKING, { score: newExpires, member: key });
  return { bonus };
}

export async function transferTime(fromUserId, toUserId, seconds) {
  if (!redis) return { ok: false };
  const fromKey = KEY_EXPIRES + String(fromUserId || '').toLowerCase();
  const toKey = KEY_EXPIRES + String(toUserId || '').toLowerCase();
  const fromExp = await redis.get(fromKey);
  const toExp = await redis.get(toKey);
  if (!fromExp) return { ok: false, error: 'sem tempo' };
  const now = Math.floor(Date.now() / 1000);
  const fromTime = Math.max(0, Number(fromExp) - now);
  if (fromTime < seconds) return { ok: false, error: 'tempo insuficiente' };
  const newFromExp = Number(fromExp) - seconds;
  const newToExp = toExp ? Number(toExp) + seconds : now + seconds;
  const fromKeyNorm = String(fromUserId || '').toLowerCase();
  const toKeyNorm = String(toUserId || '').toLowerCase();
  await redis.set(fromKey, newFromExp);
  await redis.set(toKey, newToExp);
  await redis.zadd(KEY_RANKING, { score: newFromExp, member: fromKeyNorm });
  await redis.zadd(KEY_RANKING, { score: newToExp, member: toKeyNorm });
  return { ok: true, transferred: seconds };
}

export async function syncFromHistory(userId, computedSeconds) {
  if (!redis) return { ok: false, error: 'Redis não configurado' };
  const key = String(userId).toLowerCase();
  const now = Math.floor(Date.now() / 1000);
  const existing = await redis.get(KEY_EXPIRES + key);
  let expiresAt;
  if (existing) {
    const currentRemaining = Math.max(0, Number(existing) - now);
    expiresAt = now + Math.max(computedSeconds, currentRemaining);
  } else {
    expiresAt = now + Math.max(computedSeconds, 3600);
  }
  await redis.set(KEY_EXPIRES + key, expiresAt);
  await redis.zadd(KEY_RANKING, { score: expiresAt, member: key });
  return { ok: true, time: Math.max(0, expiresAt - now) };
}

function parseZRangeWithScores(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  if (raw.length > 0) {
    const first = raw[0];
    if (typeof first === 'object' && first !== null && 'member' in first) {
      return raw.map((r) => ({ member: r.member, score: Number(r.score ?? 0) }));
    }
    if (Array.isArray(first)) {
      return raw.map((r) => ({ member: r[0], score: Number(r[1] ?? 0) }));
    }
    for (let i = 0; i < raw.length; i += 2) {
      out.push({ member: raw[i], score: Number(raw[i + 1] ?? 0) });
    }
  }
  return out;
}

export async function getRankingCount() {
  if (!redis) return 0;
  try {
    const n = await redis.zcard(KEY_RANKING);
    return typeof n === 'number' ? n : 0;
  } catch {
    return -1;
  }
}

export async function getAllUsersForMap(limit = 500) {
  if (!redis) return { users: [], online: [] };
  const [rawResults, onlineSet] = await Promise.all([
    redis.zrange(KEY_RANKING, 0, limit - 1, { rev: true, withScores: true }),
    getOnlineUsers(),
  ]);
  const results = parseZRangeWithScores(rawResults);
  const now = Math.floor(Date.now() / 1000);
  const users = results.map((r, i) => {
    const uid = String(r.member ?? r[0] ?? '').toLowerCase();
    return {
      user_id: uid,
      score: Math.max(0, (r.score ?? r[1] ?? 0) - now),
      rank: i + 1,
      online: onlineSet.has(uid),
    };
  });
  return {
    users,
    online: [...onlineSet],
  };
}

export async function getRanking(limit = 50) {
  if (!redis) return { ranking: [] };
  const raw = await redis.zrange(KEY_RANKING, 0, limit - 1, { rev: true, withScores: true });
  const results = parseZRangeWithScores(raw);
  const now = Math.floor(Date.now() / 1000);
  const ranking = results.map((r, i) => ({
    user_id: r.member ?? r[0],
    score: Math.max(0, (r.score ?? r[1] ?? 0) - now),
    rank: i + 1,
  }));
  return { ranking };
}
