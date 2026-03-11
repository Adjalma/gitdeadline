/**
 * GET /api/auth/status — Retorna user logado + config GitHub
 * GET /api/auth/status?logout=1 — Limpa cookies e redireciona (logout)
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

  if (req.query.logout === '1') {
    res.setHeader('Set-Cookie', [
      'gh_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
      'gh_user=; Path=/; SameSite=Lax; Max-Age=0',
    ]);
    return res.redirect(302, '/?logout=1');
  }

  const user = getCookie(req.headers.cookie, 'gh_user');
  const githubOAuth = !!process.env.GITHUB_CLIENT_ID && !!process.env.GITHUB_CLIENT_SECRET;
  return res.json({
    user: user ? user.toLowerCase() : null,
    githubOAuth,
  });
}
