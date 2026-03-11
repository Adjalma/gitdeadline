/**
 * Fallback: GET /api/time?user=xxx (quando /api/time/[user] não recebe o path param)
 */
import { getTime, recordPresence } from './lib/redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = (req.query?.user || '').toLowerCase();
  if (!user) return res.status(400).json({ error: 'user required' });

  recordPresence(user).catch(() => {});
  const { time } = await getTime(user);
  return res.json({ time });
}
