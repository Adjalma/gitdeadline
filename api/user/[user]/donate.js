import { transferTime } from '../../lib/redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const fromUser = (req.query.user || '').toLowerCase();
  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  } catch (_) {}
  const to = (body.to || '').toLowerCase();
  const hours = body.hours ?? 1;

  if (!fromUser || !to || fromUser === to) {
    return res.status(400).json({ error: 'Informe "to" (destinatário) válido' });
  }

  const h = Math.min(72, Math.max(1, Number(hours) || 1));
  const seconds = h * 3600;
  const result = await transferTime(fromUser, to, seconds);
  if (!result.ok) {
    return res.status(400).json({ error: result.error || 'Falha na transferência' });
  }
  return res.json({ ok: true, transferred: result.transferred, hours: h });
}
