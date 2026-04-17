import type { OctokitClient } from './client.js'
import type { GithubPullRequest } from './types.js'

/** Parses `owner` and `name` from a GitHub `repository_url` field. */
function parseRepo(repositoryUrl: string): { owner: string; name: string } | null {
  const parts = repositoryUrl.split('/')
  const name = parts[parts.length - 1]
  const owner = parts[parts.length - 2]
  if (!owner || !name) return null
  return { owner, name }
}

/**
 * Derives the PR state from the raw Search API item.
 * Returns `'merged'` when `pull_request.merged_at` is set, otherwise mirrors
 * the raw `state` field (`'open'` | `'closed'`).
 */
function derivePRState(
  rawState: string,
  mergedAt: string | null | undefined,
): 'open' | 'closed' | 'merged' {
  if (mergedAt) return 'merged'
  return rawState === 'open' ? 'open' : 'closed'
}

/**
 * Fetches all pull requests authored by `username` using the GitHub Search API
 * (`GET /search/issues?q=author:{username}+type:pr`).
 *
 * Works without a token for public PRs. When the client is authenticated the
 * results automatically include PRs from private repositories accessible to
 * the token owner.
 *
 * @param client   - A configured `OctokitClient` (may be anonymous).
 * @param username - The GitHub login of the PR author to search for.
 * @returns A list of `GithubPullRequest` objects normalised from search results.
 */
export async function fetchUserPullRequests(
  client: OctokitClient,
  username: string,
): Promise<GithubPullRequest[]> {
  const items = await client.paginate(
    client.rest.search.issuesAndPullRequests,
    { q: `author:${username} type:pr`, per_page: 100 },
  )

  const prs: GithubPullRequest[] = []

  for (const item of items) {
    const repo = parseRepo(item.repository_url ?? '')
    if (!repo) continue

    const mergedAt = item.pull_request?.merged_at ?? null

    prs.push({
      githubId: item.id,
      number: item.number,
      title: item.title,
      body: item.body ?? null,
      state: derivePRState(item.state, mergedAt),
      authorLogin: item.user?.login ?? username,
      repoOwner: repo.owner,
      repoName: repo.name,
      labels: item.labels.map((l) => (typeof l === 'string' ? l : (l.name ?? ''))).filter(Boolean),
      draft: item.draft ?? false,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      closedAt: item.closed_at ?? null,
      mergedAt,
    })
  }

  return prs
}
