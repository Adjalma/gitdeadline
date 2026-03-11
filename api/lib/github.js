/**
 * Busca histórico de contribuições do GitHub via GraphQL
 * Usado por sync e init (novos usuários)
 * Cada repositório = 1 ano de vida (31_536_000 segundos)
 */
const BONUS = { pr: 72 * 3600, issue: 48 * 3600, commit: 3600, review: 6 * 3600 };
const COMMIT_CAP_PER_YEAR = 100000;
const SECONDS_PER_YEAR = 365 * 24 * 3600;
const BONUS_PER_REPO = SECONDS_PER_YEAR; // 1 repo = 1 ano de vida

export async function fetchContributions(username, token) {
  if (!token || typeof username !== 'string' || !username) return { totalSeconds: 0, error: null };
  const now = new Date();
  let totalSeconds = 0;
  let lastError = null;
  let repoBonus = 0;
  const years = 15;

  for (let y = 0; y < years; y++) {
    const to = new Date(now.getFullYear() - y, 11, 31, 23, 59, 59);
    const from = new Date(now.getFullYear() - y, 0, 1, 0, 0, 0);
    if (from > now) continue;
    try {
      const query = `
        query($login: String!, $from: DateTime!, $to: DateTime!) {
          user(login: $login) {
            repositories(affiliations: [OWNER, COLLABORATOR], first: 1) {
              totalCount
            }
            contributionsCollection(from: $from, to: $to) {
              totalCommitContributions
              totalPullRequestContributions
              totalIssueContributions
              totalPullRequestReviewContributions
              contributionCalendar {
                totalContributions
              }
            }
          }
        }
      `;
      const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
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

      if (data.errors) {
        lastError = data.errors[0]?.message || 'GraphQL error';
        continue;
      }
      const user = data?.data?.user;
      const c = user?.contributionsCollection;
      if (!c) {
        if (user === null) lastError = 'User not found';
        continue;
      }
      if (y === 0 && user?.repositories?.totalCount != null) {
        repoBonus = (user.repositories.totalCount || 0) * BONUS_PER_REPO;
      }
      const commits = Math.min(c.totalCommitContributions || 0, COMMIT_CAP_PER_YEAR);
      const pr = (c.totalPullRequestContributions || 0) * BONUS.pr;
      const issue = (c.totalIssueContributions || 0) * BONUS.issue;
      const review = (c.totalPullRequestReviewContributions || 0) * BONUS.review;
      const commitSecs = commits * BONUS.commit;
      const yearTotal = pr + issue + review + commitSecs;
      totalSeconds += yearTotal > 0 ? yearTotal : (c.contributionCalendar?.totalContributions || 0) * 3600;
    } catch (e) {
      lastError = e.message || 'Network error';
      continue;
    }
  }
  totalSeconds += repoBonus;
  return { totalSeconds, error: totalSeconds === 0 ? lastError : null };
}
