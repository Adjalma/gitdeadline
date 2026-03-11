/**
 * Init: usuário novo → sync do histórico GitHub (tempo nunca é 24h fixo)
 * Já existente → retorna tempo atual. ?sync=1 força re-sync. Jogo 24x7.
 * Usa token OAuth do usuário (cookie) para buscar histórico.
 */
import { getTime, syncFromHistory, recordPresence } from '../../lib/redis.js';
import { fetchContributions } from '../../lib/github.js';

function getTokenFromCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(/gh_token=([^;]+)/);
  return m ? m[1].trim() : null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = (req.query.user || '').toLowerCase();
  if (!user) return res.status(400).json({ error: 'user required' });

  recordPresence(user).catch(() => {});

  const doSync = req.query.sync === '1' || req.query.sync === 'true';
  if (!doSync) {
    const existing = await getTime(user);
    if (existing.time != null && existing.time > 0) {
      return res.json({ time: existing.time });
    }
  }

  const token = getTokenFromCookie(req.headers.cookie) || process.env.GITHUB_TOKEN;
  const computed = token ? await fetchContributions(user, token) : 0;
  if (computed === 0 && !token) {
    return res.status(401).json({ error: 'Token não encontrado. Faça login novamente.', time: null });
  }
  const result = await syncFromHistory(user, Math.max(computed, 3600));
  return res.json({ time: result.ok ? result.time : 3600 });
}
