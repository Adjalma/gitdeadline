export default async function handler(req, res) {
  const { code } = req.query;
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!code || !clientId || !clientSecret) {
    return res.redirect('/?error=auth_failed');
  }
  const redirectUri = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}/api/auth/callback`;
  const isSecure = (req.headers['x-forwarded-proto'] || '').startsWith('https');
  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      return res.redirect('/?error=' + (tokenData.error_description || tokenData.error));
    }
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const user = await userRes.json();
    const username = (user.login || 'anonymous').toLowerCase();
    const secure = isSecure ? '; Secure' : '';
    const token = String(tokenData.access_token || '');
    res.setHeader('Set-Cookie', [
      `gh_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`,
      `gh_user=${encodeURIComponent(username)}; Path=/; SameSite=Lax; Max-Age=2592000${secure}`,
    ]);
    return res.redirect(302, `/?user=${encodeURIComponent(username)}`);
  } catch (e) {
    return res.redirect('/?error=auth_failed');
  }
}
