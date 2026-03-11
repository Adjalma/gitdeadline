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
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const query = req.query || {};
  try {
    if (query.map === '1' || query.map === 'true') {
      const limit = Math.min(parseInt(query.limit, 10) || 2000, 100000);
      const ping = (query.ping || '').toLowerCase();
      if (ping) {
        try {
          const { recordPresence } = await import('./lib/redis.js');
          await recordPresence(ping);
        } catch (_) {}
      }
      let users = [];
      let online = [];
      let errMsg = null;
      try {
        const data = await getAllUsersForMap(limit);
        users = data.users || [];
        online = data.online || [];
      } catch (e) {
        errMsg = e?.message || String(e);
      }
      const body = {
        users: (users || []).map((u) => ({
          user_id: u.user_id || '',
          hours: Math.floor((u.score || 0) / 3600),
          rank: u.rank || 0,
          zone: getZoneFromHours((u.score || 0) / 3600),
          online: !!u.online,
        })),
        online_count: Array.isArray(online) ? online.length : 0,
        ...(errMsg && { error: errMsg }),
      };
      if (query.debug === '1') {
        let rc = -1;
        try { rc = await getRankingCount(); } catch (_) {}
        body.debug = {
          redis_ok: isRedisConfigured(),
          ranking_count: rc,
          error: errMsg,
        };
      }
      return res.status(200).json(body);
    }
    const { ranking = [] } = await getRanking(50);
    return res.json({ ranking: ranking || [] });
  } catch (e) {
    return res.status(200).json({
      error: e?.message || 'Erro no ranking',
      users: [],
      online_count: 0,
      ranking: [],
    });
  }
}
