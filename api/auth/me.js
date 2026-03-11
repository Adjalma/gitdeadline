/**
 * GET /api/auth/me — Retorna o usuário logado (cookie gh_user)
 * Usado para restaurar sessão no refresh da página.
 */
function getCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(new RegExp(`${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1].trim()) : null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = getCookie(req.headers.cookie, 'gh_user');
  if (user) return res.json({ user: user.toLowerCase() });
  return res.json({ user: null });
}
