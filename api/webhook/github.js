import { addBonus } from '../lib/redis.js';

function extractEvent(req) {
  const event = req.headers['x-github-event'];
  let userId = '';
  let type = '';
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (event === 'pull_request' && body.action === 'closed' && body.pull_request?.merged) {
      userId = body.pull_request?.user?.login || body.pull_request?.merged_by?.login || '';
      type = 'pr_merged';
    } else if (event === 'issues' && body.action === 'closed') {
      userId = body.issue?.user?.login || '';
      type = 'issue_resolved';
    } else if (event === 'push' && body.commits?.length > 0) {
      userId = body.commits[0]?.author?.username || body.sender?.login || '';
      type = 'commit';
    }
  } catch (_) {}
  return { userId, type };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, type } = extractEvent(req);
  if (!userId || !type) return res.status(200).json({ ok: true });

  const { bonus } = await addBonus(userId, type);
  return res.json({ ok: true, bonus, user: userId });
}
