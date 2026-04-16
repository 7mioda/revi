import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { OctokitClient } from '../client.js'

// ---------------------------------------------------------------------------
// Minimal mock that satisfies the OctokitClient shape used by the fetch fns.
// We only mock the methods exercised in this file; everything else is unused.
// ---------------------------------------------------------------------------

function makeMockClient(overrides: Partial<{
  paginate: OctokitClient['paginate']
}>): OctokitClient {
  return {
    paginate: overrides.paginate ?? vi.fn().mockResolvedValue([]),
    rest: {
      pulls: {},
      issues: {},
      repos: {},
    },
    // The cast is safe — only the methods used in fetch functions matter here.
    // The full OctokitClient surface is tested via typecheck, not at runtime.
  } as unknown as OctokitClient
}

const BASE_COMMENT = {
  id: 1,
  user: { login: 'alice' },
  body: 'lgtm',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
}

describe('fetchPRReviewComments', () => {
  it('maps raw API response to GithubComment with type pr_review_comment', async () => {
    const { fetchPRReviewComments } = await import('../fetch-pr-review-comments.js')
    const raw = { ...BASE_COMMENT, path: 'src/foo.ts', diff_hunk: '@@ -1 +1 @@', pull_request_review_id: 42, pull_request_url: 'https://api.github.com/repos/owner/repo/pulls/7' }
    const client = makeMockClient({ paginate: vi.fn().mockResolvedValue([raw]) })

    const result = await fetchPRReviewComments(client, 'owner', 'repo')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      githubId: 1,
      username: 'alice',
      type: 'pr_review_comment',
      body: 'lgtm',
      path: 'src/foo.ts',
      diffHunk: '@@ -1 +1 @@',
      pullRequestNumber: 7,
      repoOwner: 'owner',
      repoName: 'repo',
    })
  })
})

describe('fetchPRComments', () => {
  it('keeps only issues that have a pull_request field', async () => {
    const { fetchPRComments } = await import('../fetch-pr-comments.js')
    const prComment = { ...BASE_COMMENT, pull_request_url: 'https://api.github.com/repos/owner/repo/issues/3', issue_url: 'https://api.github.com/repos/owner/repo/issues/3' }
    const issueComment = { ...BASE_COMMENT, id: 2 } // no pull_request_url
    const client = makeMockClient({ paginate: vi.fn().mockResolvedValue([prComment, issueComment]) })

    const result = await fetchPRComments(client, 'owner', 'repo')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ type: 'pr_comment', githubId: 1, pullRequestNumber: 3 })
  })
})

describe('fetchCommitComments', () => {
  it('maps to GithubComment with type commit_comment', async () => {
    const { fetchCommitComments } = await import('../fetch-commit-comments.js')
    const raw = { ...BASE_COMMENT }
    const client = makeMockClient({ paginate: vi.fn().mockResolvedValue([raw]) })

    const result = await fetchCommitComments(client, 'owner', 'repo')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ type: 'commit_comment', githubId: 1, path: null, diffHunk: null, pullRequestNumber: null })
  })
})

describe('fetchAllComments', () => {
  it('merges all three sources and returns tagged union', async () => {
    const { fetchAllComments } = await import('../fetch-all-comments.js')

    const reviewRaw = { ...BASE_COMMENT, path: 'a.ts', diff_hunk: '@@ @@', pull_request_url: 'https://api.github.com/repos/o/r/pulls/1' }
    const prRaw = { ...BASE_COMMENT, id: 2, pull_request_url: 'https://api.github.com/repos/o/r/issues/2', issue_url: 'x' }
    const commitRaw = { ...BASE_COMMENT, id: 3 }

    let callCount = 0
    const paginate = vi.fn().mockImplementation(() => {
      const responses = [[reviewRaw], [prRaw, commitRaw /* issue comment — no pull_request_url */], [commitRaw]]
      return Promise.resolve(responses[callCount++] ?? [])
    })
    const client = makeMockClient({ paginate })

    const result = await fetchAllComments(client, 'o', 'r')

    const types = result.map((c) => c.type)
    expect(types).toContain('pr_review_comment')
    expect(types).toContain('commit_comment')
  })
})

describe('getUserRepos', () => {
  it('returns RepoRef array from paginated response', async () => {
    const { getUserRepos } = await import('../get-user-repos.js')
    const raw = { owner: { login: 'alice' }, name: 'my-repo' }
    const client = makeMockClient({ paginate: vi.fn().mockResolvedValue([raw]) })

    const result = await getUserRepos(client, 'alice')

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ owner: 'alice', name: 'my-repo' })
  })
})
