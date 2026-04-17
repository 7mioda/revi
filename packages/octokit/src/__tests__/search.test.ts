import { describe, it, expect, vi } from 'vitest'
import type { OctokitClient } from '../client.js'

function makeMockClient(paginate: OctokitClient['paginate']): OctokitClient {
  return {
    paginate,
    rest: { search: { issuesAndPullRequests: vi.fn() } },
  } as unknown as OctokitClient
}

// A minimal search API item that represents an issue.
const BASE_ISSUE_ITEM = {
  id: 101,
  number: 5,
  title: 'Fix the bug',
  body: 'It crashes on null.',
  state: 'open',
  user: { login: 'alice' },
  repository_url: 'https://api.github.com/repos/org/repo',
  labels: [{ name: 'bug' }, { name: 'help wanted' }],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
  closed_at: null,
  // No `pull_request` key — confirms this is an issue
}

// A minimal search API item that represents a pull request.
const BASE_PR_ITEM = {
  id: 202,
  number: 12,
  title: 'Add feature',
  body: 'This adds X.',
  state: 'closed',
  user: { login: 'alice' },
  repository_url: 'https://api.github.com/repos/org/repo',
  labels: [{ name: 'enhancement' }],
  created_at: '2024-02-01T00:00:00Z',
  updated_at: '2024-02-02T00:00:00Z',
  closed_at: '2024-02-03T00:00:00Z',
  pull_request: {
    merged_at: '2024-02-03T12:00:00Z',
    url: 'https://api.github.com/repos/org/repo/pulls/12',
  },
  draft: false,
}

// ---------------------------------------------------------------------------
// fetchUserIssues
// ---------------------------------------------------------------------------

describe('fetchUserIssues', () => {
  it('maps a search result item to GithubIssue', async () => {
    const { fetchUserIssues } = await import('../fetch-user-issues.js')
    const client = makeMockClient(vi.fn().mockResolvedValue([BASE_ISSUE_ITEM]))

    const result = await fetchUserIssues(client, 'alice')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      githubId: 101,
      number: 5,
      title: 'Fix the bug',
      body: 'It crashes on null.',
      state: 'open',
      authorLogin: 'alice',
      repoOwner: 'org',
      repoName: 'repo',
      labels: ['bug', 'help wanted'],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      closedAt: null,
    })
  })

  it('uses author:{username} type:issue as the search query', async () => {
    const { fetchUserIssues } = await import('../fetch-user-issues.js')
    const paginate = vi.fn().mockResolvedValue([])
    const client = makeMockClient(paginate)

    await fetchUserIssues(client, 'bob')

    expect(paginate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ q: 'author:bob type:issue' }),
    )
  })

  it('returns empty array when no issues found', async () => {
    const { fetchUserIssues } = await import('../fetch-user-issues.js')
    const client = makeMockClient(vi.fn().mockResolvedValue([]))

    const result = await fetchUserIssues(client, 'alice')

    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// fetchUserPullRequests
// ---------------------------------------------------------------------------

describe('fetchUserPullRequests', () => {
  it('maps a search result item to GithubPullRequest', async () => {
    const { fetchUserPullRequests } = await import('../fetch-user-pull-requests.js')
    const client = makeMockClient(vi.fn().mockResolvedValue([BASE_PR_ITEM]))

    const result = await fetchUserPullRequests(client, 'alice')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      githubId: 202,
      number: 12,
      title: 'Add feature',
      body: 'This adds X.',
      state: 'merged',
      authorLogin: 'alice',
      repoOwner: 'org',
      repoName: 'repo',
      labels: ['enhancement'],
      draft: false,
      createdAt: '2024-02-01T00:00:00Z',
      updatedAt: '2024-02-02T00:00:00Z',
      closedAt: '2024-02-03T00:00:00Z',
      mergedAt: '2024-02-03T12:00:00Z',
    })
  })

  it('sets state to "closed" when PR is closed but not merged', async () => {
    const { fetchUserPullRequests } = await import('../fetch-user-pull-requests.js')
    const item = { ...BASE_PR_ITEM, state: 'closed', pull_request: { merged_at: null, url: '' } }
    const client = makeMockClient(vi.fn().mockResolvedValue([item]))

    const result = await fetchUserPullRequests(client, 'alice')

    expect(result[0]?.state).toBe('closed')
  })

  it('sets state to "open" when PR is open', async () => {
    const { fetchUserPullRequests } = await import('../fetch-user-pull-requests.js')
    const item = { ...BASE_PR_ITEM, state: 'open', pull_request: { merged_at: null, url: '' } }
    const client = makeMockClient(vi.fn().mockResolvedValue([item]))

    const result = await fetchUserPullRequests(client, 'alice')

    expect(result[0]?.state).toBe('open')
  })

  it('uses author:{username} type:pr as the search query', async () => {
    const { fetchUserPullRequests } = await import('../fetch-user-pull-requests.js')
    const paginate = vi.fn().mockResolvedValue([])
    const client = makeMockClient(paginate)

    await fetchUserPullRequests(client, 'carol')

    expect(paginate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ q: 'author:carol type:pr' }),
    )
  })
})
