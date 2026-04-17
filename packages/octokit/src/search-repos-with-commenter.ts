import type { OctokitClient } from './client.js'
import type { RepoRef } from './types.js'

/**
 * Uses the GitHub Search API to find every repository where `username` has
 * posted at least one comment (issue comment, PR comment, or PR review comment).
 *
 * Strategy: `GET /search/issues?q=commenter:{username}` returns all issues and
 * pull requests the user has commented on, across every public repo on GitHub —
 * not just repos they own. We deduplicate by `owner/name` and return the unique
 * set of `RepoRef` values.
 *
 * This is far more complete than listing the user's own repos, which misses the
 * vast majority of open-source contribution activity.
 *
 * @param client   - A configured `OctokitClient`.
 * @param username - The GitHub login to search for.
 * @returns De-duplicated list of repos where the user has commented.
 */
export async function searchReposWithCommenter(
  client: OctokitClient,
  username: string,
): Promise<RepoRef[]> {
  const items = await client.paginate(
    client.rest.search.issuesAndPullRequests,
    {
      q: `commenter:${username}`,
      per_page: 100,
    },
  )

  const seen = new Set<string>()
  const repos: RepoRef[] = []

  for (const item of items) {
    // repository_url is e.g. "https://api.github.com/repos/owner/name"
    const repoUrl = item.repository_url
    if (!repoUrl) continue

    const parts = repoUrl.split('/')
    const name = parts[parts.length - 1]
    const owner = parts[parts.length - 2]
    if (!owner || !name) continue

    const key = `${owner}/${name}`
    if (!seen.has(key)) {
      seen.add(key)
      repos.push({ owner, name })
    }
  }

  return repos
}
