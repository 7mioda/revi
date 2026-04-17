import 'reflect-metadata'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock @revi/octokit before importing the service so vi.mock hoisting works.
// ---------------------------------------------------------------------------
vi.mock('@revi/octokit', () => ({
  createOctokitClient: vi.fn().mockReturnValue({}),
  fetchUserIssues: vi.fn().mockResolvedValue([]),
  fetchUserPullRequests: vi.fn().mockResolvedValue([]),
  fetchPRDiff: vi.fn().mockResolvedValue([]),
  searchReposWithCommenter: vi.fn().mockResolvedValue([]),
  listAccessibleRepos: vi.fn().mockResolvedValue([]),
  fetchAllComments: vi.fn().mockResolvedValue([]),
}))

import * as octokit from '@revi/octokit'

import { UsersService } from '../users/users.service.js'

// ---------------------------------------------------------------------------
// Minimal Mongoose model mock — supports findOneAndUpdate only.
// ---------------------------------------------------------------------------
function makeModel() {
  return {
    findOneAndUpdate: vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue(null) }),
  }
}

function makeConfigService(token = 'server-token') {
  // Cast as never: the mock only needs `get()` to return the token; strict generic params are irrelevant here.
  return { get: vi.fn().mockReturnValue(token) } as never
}

function makeService() {
  return new UsersService(
    makeModel() as never,
    makeModel() as never,
    makeModel() as never,
    makeConfigService(),
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(octokit.createOctokitClient).mockReturnValue({} as never)
  vi.mocked(octokit.fetchUserIssues).mockResolvedValue([])
  vi.mocked(octokit.fetchUserPullRequests).mockResolvedValue([])
  vi.mocked(octokit.fetchPRDiff).mockResolvedValue([])
  vi.mocked(octokit.searchReposWithCommenter).mockResolvedValue([])
  vi.mocked(octokit.listAccessibleRepos).mockResolvedValue([])
  vi.mocked(octokit.fetchAllComments).mockResolvedValue([])
})

describe('UsersService.fetchAndSave', () => {
  it('returns zero counts when everything is empty', async () => {
    const service = makeService()

    const result = await service.fetchAndSave('alice')

    expect(result).toEqual({ user: 'alice', issues: 0, pullRequests: 0, comments: 0 })
  })

  it('creates an anonymous client when no token is supplied', async () => {
    const service = makeService()

    await service.fetchAndSave('alice')

    expect(octokit.createOctokitClient).toHaveBeenCalledWith(undefined)
  })

  it('creates an authenticated client when a token is supplied', async () => {
    const service = makeService()

    await service.fetchAndSave('alice', 'ghp_mytoken')

    expect(octokit.createOctokitClient).toHaveBeenCalledWith('ghp_mytoken')
  })

  it('does NOT call listAccessibleRepos when no token is given', async () => {
    const service = makeService()

    await service.fetchAndSave('alice')

    expect(octokit.listAccessibleRepos).not.toHaveBeenCalled()
  })

  it('calls listAccessibleRepos when a token is provided', async () => {
    const service = makeService()

    await service.fetchAndSave('alice', 'ghp_mytoken')

    expect(octokit.listAccessibleRepos).toHaveBeenCalledOnce()
  })

  it('fetches comments for each discovered repo', async () => {
    vi.mocked(octokit.searchReposWithCommenter).mockResolvedValue([
      { owner: 'org', name: 'repo-a' },
      { owner: 'org', name: 'repo-b' },
    ])
    const service = makeService()

    await service.fetchAndSave('alice')

    expect(octokit.fetchAllComments).toHaveBeenCalledWith(expect.anything(), 'org', 'repo-a')
    expect(octokit.fetchAllComments).toHaveBeenCalledWith(expect.anything(), 'org', 'repo-b')
  })

  it('filters comments to only those authored by the target user', async () => {
    vi.mocked(octokit.searchReposWithCommenter).mockResolvedValue([{ owner: 'o', name: 'r' }])
    vi.mocked(octokit.fetchAllComments).mockResolvedValue([
      { username: 'alice', githubId: 1, type: 'pr_comment', body: '', path: null, diffHunk: null, pullRequestNumber: null, repoOwner: 'o', repoName: 'r', createdAt: '', updatedAt: '' },
      { username: 'bob', githubId: 2, type: 'pr_comment', body: '', path: null, diffHunk: null, pullRequestNumber: null, repoOwner: 'o', repoName: 'r', createdAt: '', updatedAt: '' },
    ])
    const commentModel = makeModel()
    const service = new UsersService(
      makeModel() as never,
      makeModel() as never,
      commentModel as never,
      makeConfigService(),
    )

    const result = await service.fetchAndSave('alice')

    expect(result.comments).toBe(1)
    expect(commentModel.findOneAndUpdate).toHaveBeenCalledOnce()
    expect(commentModel.findOneAndUpdate).toHaveBeenCalledWith(
      { githubId: 1 },
      expect.objectContaining({ username: 'alice', userId: 'alice' }),
      { upsert: true, new: true },
    )
  })

  it('counts saved issues from step 1', async () => {
    vi.mocked(octokit.fetchUserIssues).mockResolvedValue([
      { githubId: 10, number: 1, title: 'Bug', body: null, state: 'open', authorLogin: 'alice', repoOwner: 'o', repoName: 'r', labels: [], createdAt: '', updatedAt: '', closedAt: null },
      { githubId: 11, number: 2, title: 'Feature', body: null, state: 'closed', authorLogin: 'alice', repoOwner: 'o', repoName: 'r', labels: [], createdAt: '', updatedAt: '', closedAt: null },
    ])
    const service = makeService()

    const result = await service.fetchAndSave('alice')

    expect(result.issues).toBe(2)
  })

  it('counts saved PRs from step 2', async () => {
    vi.mocked(octokit.fetchUserPullRequests).mockResolvedValue([
      { githubId: 20, number: 3, title: 'PR', body: null, state: 'merged', authorLogin: 'alice', repoOwner: 'o', repoName: 'r', labels: [], draft: false, createdAt: '', updatedAt: '', closedAt: null, mergedAt: null },
    ])
    const service = makeService()

    const result = await service.fetchAndSave('alice')

    expect(result.pullRequests).toBe(1)
  })

  it('fetches the diff for each PR in step 2', async () => {
    vi.mocked(octokit.fetchUserPullRequests).mockResolvedValue([
      { githubId: 20, number: 3, title: 'PR A', body: null, state: 'merged', authorLogin: 'alice', repoOwner: 'org', repoName: 'repo-a', labels: [], draft: false, createdAt: '', updatedAt: '', closedAt: null, mergedAt: null },
      { githubId: 21, number: 7, title: 'PR B', body: null, state: 'open',   authorLogin: 'alice', repoOwner: 'org', repoName: 'repo-b', labels: [], draft: false, createdAt: '', updatedAt: '', closedAt: null, mergedAt: null },
    ])
    const service = makeService()

    await service.fetchAndSave('alice')

    expect(octokit.fetchPRDiff).toHaveBeenCalledWith(expect.anything(), 'org', 'repo-a', 3)
    expect(octokit.fetchPRDiff).toHaveBeenCalledWith(expect.anything(), 'org', 'repo-b', 7)
  })

  it('saves each PR with its files immediately after fetching the diff', async () => {
    const files = [{ filename: 'src/foo.ts', status: 'modified', patch: '@@ -1 +1 @@' }]
    vi.mocked(octokit.fetchUserPullRequests).mockResolvedValue([
      { githubId: 20, number: 3, title: 'PR', body: null, state: 'open', authorLogin: 'alice', repoOwner: 'o', repoName: 'r', labels: [], draft: false, createdAt: '', updatedAt: '', closedAt: null, mergedAt: null },
    ])
    vi.mocked(octokit.fetchPRDiff).mockResolvedValue(files)
    const prModel = makeModel()
    const service = new UsersService(
      makeModel() as never,
      prModel as never,
      makeModel() as never,
      makeConfigService(),
    )

    await service.fetchAndSave('alice')

    expect(prModel.findOneAndUpdate).toHaveBeenCalledWith(
      { githubId: 20 },
      expect.objectContaining({ files, userId: 'alice' }),
      { upsert: true, new: true },
    )
  })

  it('continues to next PR when diff fetch fails', async () => {
    vi.mocked(octokit.fetchUserPullRequests).mockResolvedValue([
      { githubId: 20, number: 3, title: 'PR A', body: null, state: 'open', authorLogin: 'alice', repoOwner: 'o', repoName: 'r1', labels: [], draft: false, createdAt: '', updatedAt: '', closedAt: null, mergedAt: null },
      { githubId: 21, number: 4, title: 'PR B', body: null, state: 'open', authorLogin: 'alice', repoOwner: 'o', repoName: 'r2', labels: [], draft: false, createdAt: '', updatedAt: '', closedAt: null, mergedAt: null },
    ])
    vi.mocked(octokit.fetchPRDiff)
      .mockRejectedValueOnce(Object.assign(new Error('not found'), { status: 404 }))
      .mockResolvedValueOnce([])
    const prModel = makeModel()
    const service = new UsersService(
      makeModel() as never,
      prModel as never,
      makeModel() as never,
      makeConfigService(),
    )

    // Should not throw; second PR is still saved
    await expect(service.fetchAndSave('alice')).resolves.toMatchObject({ pullRequests: 2 })
    expect(prModel.findOneAndUpdate).toHaveBeenCalledTimes(2)
  })

  it('deduplicates repos found by search and listAccessibleRepos', async () => {
    vi.mocked(octokit.searchReposWithCommenter).mockResolvedValue([
      { owner: 'org', name: 'shared' },
      { owner: 'org', name: 'public-only' },
    ])
    vi.mocked(octokit.listAccessibleRepos).mockResolvedValue([
      { owner: 'org', name: 'shared' },       // duplicate
      { owner: 'org', name: 'private-only' },
    ])
    const service = makeService()

    await service.fetchAndSave('alice', 'ghp_token')

    // fetchAllComments should be called 3 times, not 4 (deduped)
    expect(octokit.fetchAllComments).toHaveBeenCalledTimes(3)
  })
})
