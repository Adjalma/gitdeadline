/**
 * Init: usuário novo → sync do histórico GitHub (tempo nunca é 24h fixo)
 * Já existente → retorna tempo atual. Jogo 24x7 — nunca reinicia.
 */
import { getTime, syncFromHistory, recordPresence } from '../../lib/redis.js';
import { fetchContributions } from '../../lib/github.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { user } = req.query;
  if (!user) return res.status(400).json({ error: 'user required' });

  recordPresence(user).catch(() => {});
  const existing = await getTime(user);
  if (existing.time != null && existing.time > 0) {
    return res.json({ time: existing.time });
  }

  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_CLIENT_SECRET;
  const computed = token ? await fetchContributions(user, token) : 0;
  const result = await syncFromHistory(user, Math.max(computed, 3600));
  return res.json({ time: result.ok ? result.time : 3600 });
}
