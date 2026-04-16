import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { GithubComment, RepoRef, AuthenticatedUser } from '@revi/octokit'

// ---------------------------------------------------------------------------
// The script is a side-effectful entrypoint, so we test its pure helper:
// buildOutput, which computes the JSON payload from raw data.
// ---------------------------------------------------------------------------

const BASE_COMMENT: GithubComment = {
  githubId: 1,
  username: 'alice',
  type: 'pr_review_comment',
  body: 'looks good',
  path: 'src/index.ts',
  diffHunk: '@@ -1 +1 @@',
  pullRequestNumber: 3,
  repoOwner: 'alice',
  repoName: 'repo-a',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

describe('buildOutput', () => {
  it('counts only the authenticated user comments', async () => {
    const { buildOutput } = await import('../scripts/fetch-my-comments.js')

    const otherComment: GithubComment = { ...BASE_COMMENT, githubId: 2, username: 'bob' }
    const user: AuthenticatedUser = { login: 'alice', id: 99 }
    const repos: RepoRef[] = [{ owner: 'alice', name: 'repo-a' }]
    const allComments = [BASE_COMMENT, otherComment]

    const output = buildOutput(user, repos, allComments)

    expect(output.user).toBe('alice')
    expect(output.totalRepos).toBe(1)
    expect(output.totalComments).toBe(1)
    expect(output.comments).toHaveLength(1)
    expect(output.comments[0]?.username).toBe('alice')
  })

  it('includes a fetchedAt ISO timestamp', async () => {
    const { buildOutput } = await import('../scripts/fetch-my-comments.js')
    const user: AuthenticatedUser = { login: 'alice', id: 99 }

    const output = buildOutput(user, [], [])

    expect(() => new Date(output.fetchedAt)).not.toThrow()
    expect(output.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('getToken', () => {
  const originalEnv = process.env['GITHUB_TOKEN']

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env['GITHUB_TOKEN']
    } else {
      process.env['GITHUB_TOKEN'] = originalEnv
    }
  })

  it('returns the token when GITHUB_TOKEN is set', async () => {
    const { getToken } = await import('../scripts/fetch-my-comments.js')
    process.env['GITHUB_TOKEN'] = 'ghp_test123'
    expect(getToken()).toBe('ghp_test123')
  })

  it('throws when GITHUB_TOKEN is missing', async () => {
    const { getToken } = await import('../scripts/fetch-my-comments.js')
    delete process.env['GITHUB_TOKEN']
    expect(() => getToken()).toThrow(/GITHUB_TOKEN/)
  })
})
