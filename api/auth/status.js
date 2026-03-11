export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const configured = !!process.env.GITHUB_CLIENT_ID && !!process.env.GITHUB_CLIENT_SECRET;
  return res.json({ githubOAuth: configured });
}
