import type { OctokitClient } from './client.js'
import type { PRFile } from './types.js'

/**
 * Fetches the full list of changed files (with unified diff patches) for a
 * pull request using `GET /repos/{owner}/{repo}/pulls/{pull_number}/files`.
 *
 * Pagination is handled automatically so PRs with more than 100 changed files
 * are fully covered.
 *
 * @param client     - A configured `OctokitClient`.
 * @param owner      - Repository owner (org or user login).
 * @param repo       - Repository name.
 * @param pullNumber - Pull request number.
 * @returns An array of `PRFile` objects. The `patch` field is absent for
 *   binary files and files whose diff exceeds GitHub's size limit.
 */
export async function fetchPRDiff(
  client: OctokitClient,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PRFile[]> {
  const items = await client.paginate(
    client.rest.pulls.listFiles,
    { owner, repo, pull_number: pullNumber, per_page: 100 },
  )

  return items.map((item) => {
    const file: PRFile = { filename: item.filename, status: item.status }
    if (item.patch !== undefined) {
      file.patch = item.patch
    }
    return file
  })
}
