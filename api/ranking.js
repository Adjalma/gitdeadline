/**
 * GET /api/ranking → ranking (limit 50)
 * GET /api/ranking?map=1&limit=200 → dados do mapa mundi (usuários, zona, online)
 */
import { getRanking, getAllUsersForMap, getRankingCount, isRedisConfigured } from './lib/redis.js';

function getZoneFromHours(hours) {
  if (hours < 24) return 'dev_null';
  if (hours < 720) return 'home_user';
  return 'root';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (req.query.map === '1' || req.query.map === 'true') {
      const limit = Math.min(parseInt(req.query.limit, 10) || 500, 5000);
      const ping = (req.query.ping || '').toLowerCase();
      if (ping) {
        const { recordPresence } = await import('./lib/redis.js');
        recordPresence(ping).catch(() => {});
      }
      const { users = [], online = [] } = await getAllUsersForMap(limit);
      const body = {
        users: (users || []).map((u) => ({
          user_id: u.user_id,
          hours: Math.floor((u.score || 0) / 3600),
          rank: u.rank,
          zone: getZoneFromHours((u.score || 0) / 3600),
          online: !!u.online,
        })),
        online_count: (online || []).length,
      };
      if (req.query.debug === '1') {
        body.debug = {
          redis_ok: isRedisConfigured(),
          ranking_count: await getRankingCount(),
          hint: 'Se ranking_count=0, use o token DEFAULT (não Read-Only) no Upstash',
        };
      }
      return res.json(body);
    }
    const { ranking = [] } = await getRanking(50);
    return res.json({ ranking: ranking || [] });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Erro no ranking', users: [], ranking: [] });
  }
}
