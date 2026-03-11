/**
 * API Mapa Mundi — usuários por zona, tempo, online
 * GET /api/map → { users, online }
 */
import { getAllUsersForMap } from './lib/redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const limit = Math.min(parseInt(req.query.limit, 10) || 500, 1000);
  const { users, online } = await getAllUsersForMap(limit);
  return res.json({
    users: users.map((u) => ({
      user_id: u.user_id,
      hours: Math.floor(u.score / 3600),
      rank: u.rank,
      zone: getZoneFromHours(u.score / 3600),
      online: !!u.online,
    })),
    online_count: online.length,
  });
}

function getZoneFromHours(hours) {
  if (hours < 24) return 'dev_null';
  if (hours < 720) return 'home_user';
  return 'root';
}
