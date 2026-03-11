export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Set-Cookie', [
    'gh_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
    'gh_user=; Path=/; SameSite=Lax; Max-Age=0',
  ]);
  return res.redirect(302, '/?logout=1');
}
