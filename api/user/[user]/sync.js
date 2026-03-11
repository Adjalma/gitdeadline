/**
 * Sync do histórico completo do GitHub → computa tempo total do usuário
 * Jogo 24x7: tempo NUNCA reinicia, só cresce com contribuições
 */
import { fetchContributions } from '../../lib/github.js';
import { syncFromHistory } from '../../lib/redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { user } = req.query;
  if (!user) return res.status(400).json({ error: 'user required' });

  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_CLIENT_SECRET;
  if (!token) {
    return res.status(500).json({ error: 'GITHUB_TOKEN não configurado para sync' });
  }

  try {
    const computed = await fetchContributions(user, token);
    const result = await syncFromHistory(user, computed);
    if (!result.ok) {
      return res.json({ time: computed, synced: false, message: result.error || 'Redis não configurado' });
    }
    return res.json({
      ok: true,
      time: result.time,
      computed,
      message: 'Histórico computado. Jogo 24x7 — tempo nunca reinicia.',
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Erro ao sync' });
  }
}
