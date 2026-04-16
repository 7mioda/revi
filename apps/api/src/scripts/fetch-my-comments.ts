/**
 * fetch-my-comments.ts
 *
 * One-shot script: given a GITHUB_TOKEN, fetches every comment the
 * authenticated user has made across all accessible repositories and writes
 * the result to `output/my-comments.json`.
 *
 * Usage:
 *   GITHUB_TOKEN=<pat> node --experimental-transform-types src/scripts/fetch-my-comments.ts
 */

import fs from 'fs'
import path from 'path'
import {
  createOctokitClient,
  getAuthenticatedUser,
  listAccessibleRepos,
  fetchAllComments,
} from '@revi/octokit'
import type { AuthenticatedUser, GithubComment, RepoRef } from '@revi/octokit'

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit testing)
// ---------------------------------------------------------------------------

/** The shape written to `output/my-comments.json`. */
export interface MyCommentsOutput {
  user: string
  fetchedAt: string
  totalRepos: number
  totalComments: number
  comments: GithubComment[]
}

/**
 * Reads `GITHUB_TOKEN` from the environment.
 * Throws a descriptive error if the variable is absent.
 */
export function getToken(): string {
  const token = process.env['GITHUB_TOKEN']
  if (token === undefined || token.length === 0) {
    throw new Error('GITHUB_TOKEN environment variable is required but not set.')
  }
  return token
}

/**
 * Builds the final JSON output from the fetched data.
 * Filters `allComments` to only those authored by `user`.
 *
 * @param user - The authenticated GitHub user.
 * @param repos - All repos that were scanned.
 * @param allComments - Raw (unfiltered) comments from all repos.
 */
export function buildOutput(
  user: AuthenticatedUser,
  repos: RepoRef[],
  allComments: GithubComment[],
): MyCommentsOutput {
  const mine = allComments.filter((c) => c.username === user.login)
  return {
    user: user.login,
    fetchedAt: new Date().toISOString(),
    totalRepos: repos.length,
    totalComments: mine.length,
    comments: mine,
  }
}

// ---------------------------------------------------------------------------
// Script entrypoint — only runs when executed directly, not when imported
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const token = getToken()
  const client = createOctokitClient(token)

  process.stderr.write('Identifying authenticated user…\n')
  const user = await getAuthenticatedUser(client)
  process.stderr.write(`Authenticated as: ${user.login}\n`)

  process.stderr.write('Discovering accessible repositories…\n')
  const repos = await listAccessibleRepos(client)
  process.stderr.write(`Found ${repos.length} repos. Fetching comments…\n`)

  const allComments: GithubComment[] = []
  for (const repo of repos) {
    const slug = `${repo.owner}/${repo.name}`
    try {
      const comments = await fetchAllComments(client, repo.owner, repo.name)
      allComments.push(...comments)
      process.stderr.write(`  ${slug} — ${comments.length} comments\n`)
    } catch (err: unknown) {
      // Skip repos that are blocked (451 DMCA), archived with no access, etc.
      const status = typeof err === 'object' && err !== null && 'status' in err
        ? (err as { status: number }).status
        : undefined
      process.stderr.write(`  ${slug} — skipped (HTTP ${status ?? 'error'})\n`)
    }
  }

  const output = buildOutput(user, repos, allComments)

  const outputDir = path.resolve('output')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  const outputPath = path.join(outputDir, 'my-comments.json')
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2))

  process.stderr.write(
    `\nDone. ${output.totalComments} comment(s) by ${output.user} written to ${outputPath}\n`,
  )
}

// Run only when this file is the entrypoint, not when imported by tests.
// `import.meta.url` is the file URL; `process.argv[1]` is the resolved script path.
const scriptUrl = new URL(import.meta.url)
const entryUrl = new URL(`file://${path.resolve(process.argv[1] ?? '')}`)
if (scriptUrl.href === entryUrl.href) {
  main().catch((err: unknown) => {
    process.stderr.write(`Error: ${String(err)}\n`)
    process.exit(1)
  })
}
