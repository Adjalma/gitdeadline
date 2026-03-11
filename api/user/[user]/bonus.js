import { addBonus } from '../../lib/redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = (req.query?.user || (req.url || '').match(/\/user\/([^/?]+)\/bonus/)?.[1] || '').toLowerCase();
  if (!user) return res.status(400).json({ error: 'user required' });

  const event = req.query.event || 'commit';
  const { bonus } = await addBonus(user, event);
  return res.json({ ok: true, bonus, event });
}
