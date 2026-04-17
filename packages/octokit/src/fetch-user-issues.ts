import type { OctokitClient } from './client.js'
import type { GithubIssue } from './types.js'

/** Parses `owner` and `name` from a GitHub `repository_url` field. */
function parseRepo(repositoryUrl: string): { owner: string; name: string } | null {
  const parts = repositoryUrl.split('/')
  const name = parts[parts.length - 1]
  const owner = parts[parts.length - 2]
  if (!owner || !name) return null
  return { owner, name }
}

/**
 * Fetches all issues authored by `username` using the GitHub Search API
 * (`GET /search/issues?q=author:{username}+type:issue`).
 *
 * Works without a token for public issues. When the client is authenticated
 * the results automatically include issues from private repositories accessible
 * to the token owner.
 *
 * @param client   - A configured `OctokitClient` (may be anonymous).
 * @param username - The GitHub login of the issue author to search for.
 * @returns A list of `GithubIssue` objects normalised from the search results.
 */
export async function fetchUserIssues(
  client: OctokitClient,
  username: string,
): Promise<GithubIssue[]> {
  const items = await client.paginate(
    client.rest.search.issuesAndPullRequests,
    { q: `author:${username} type:issue`, per_page: 100 },
  )

  const issues: GithubIssue[] = []

  for (const item of items) {
    const repo = parseRepo(item.repository_url ?? '')
    if (!repo) continue

    issues.push({
      githubId: item.id,
      number: item.number,
      title: item.title,
      body: item.body ?? null,
      state: item.state === 'open' ? 'open' : 'closed',
      authorLogin: item.user?.login ?? username,
      repoOwner: repo.owner,
      repoName: repo.name,
      labels: item.labels.map((l) => (typeof l === 'string' ? l : (l.name ?? ''))).filter(Boolean),
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      closedAt: item.closed_at ?? null,
    })
  }

  return issues
}
