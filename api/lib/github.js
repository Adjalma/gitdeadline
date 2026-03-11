/**
 * Busca histórico de contribuições do GitHub via GraphQL
 * Usado por sync e init (novos usuários)
 */
const BONUS = { pr: 72 * 3600, issue: 48 * 3600, commit: 3600, review: 6 * 3600 };
const COMMIT_CAP_PER_DAY = 24;

export async function fetchContributions(username, token) {
  if (!token) return 0;
  const now = new Date();
  let totalSeconds = 0;
  const years = 15;
  for (let y = 0; y < years; y++) {
    const to = new Date(now.getFullYear() - y, 11, 31, 23, 59, 59);
    const from = new Date(now.getFullYear() - y, 0, 1, 0, 0, 0);
    if (from > now) continue;
    try {
      const query = `
        query($login: String!, $from: DateTime!, $to: DateTime!) {
          user(login: $login) {
            contributionsCollection(from: $from, to: $to) {
              totalCommitContributions
              totalPullRequestContributions
              totalIssueContributions
              totalPullRequestReviewContributions
            }
          }
        }
      `;
      const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: {
            login: username,
            from: from.toISOString(),
            to: to.toISOString(),
          },
        }),
      });
      const data = await res.json();
      if (data.errors) break;
      const c = data?.data?.user?.contributionsCollection;
      if (!c) break;
      const commits = Math.min(c.totalCommitContributions || 0, COMMIT_CAP_PER_DAY * 365);
      totalSeconds += (c.totalPullRequestContributions || 0) * BONUS.pr;
      totalSeconds += (c.totalIssueContributions || 0) * BONUS.issue;
      totalSeconds += (c.totalPullRequestReviewContributions || 0) * BONUS.review;
      totalSeconds += commits * BONUS.commit;
    } catch (_) {
      break;
    }
  }
  return totalSeconds;
}
