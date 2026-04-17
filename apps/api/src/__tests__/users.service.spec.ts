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

// ---------------------------------------------------------------------------
// Minimal JobsService mock
// ---------------------------------------------------------------------------
function makeJobsService() {
  return {
    markRunning: vi.fn().mockResolvedValue(undefined),
    updateStep: vi.fn().mockResolvedValue(undefined),
    markDone: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
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
    makeJobsService() as never,
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

describe('UsersService.run', () => {
  it('completes without error when everything is empty', async () => {
    const service = makeService()
    await expect(service.run('job-1', 'alice')).resolves.toBeUndefined()
  })

  it('falls back to server GITHUB_TOKEN when no user token is supplied', async () => {
    const service = makeService() // makeConfigService returns 'server-token'
    await service.run('job-1', 'alice')
    expect(octokit.createOctokitClient).toHaveBeenCalledWith('server-token')
  })

  it('uses the user token when one is supplied, ignoring the server token', async () => {
    const service = makeService()
    await service.run('job-1', 'alice', 'ghp_mytoken')
    expect(octokit.createOctokitClient).toHaveBeenCalledWith('ghp_mytoken')
  })

  it('marks the job running then done on success', async () => {
    const jobsService = makeJobsService()
    const service = new UsersService(makeModel() as never, makeModel() as never, makeModel() as never, jobsService as never, makeConfigService())

    await service.run('job-1', 'alice')

    expect(jobsService.markRunning).toHaveBeenCalledWith('job-1')
    expect(jobsService.markDone).toHaveBeenCalledWith('job-1')
    expect(jobsService.markFailed).not.toHaveBeenCalled()
  })

  it('marks each step running before it starts and done after it completes', async () => {
    const jobsService = makeJobsService()
    const service = new UsersService(makeModel() as never, makeModel() as never, makeModel() as never, jobsService as never, makeConfigService())

    await service.run('job-1', 'alice')

    // All four steps get a 'running' call followed by a 'done' call
    for (const step of ['issues', 'pullRequests', 'repos', 'comments']) {
      expect(jobsService.updateStep).toHaveBeenCalledWith('job-1', step, 'running')
      expect(jobsService.updateStep).toHaveBeenCalledWith('job-1', step, 'done', expect.any(Number))
    }
  })

  it('marks job failed when an unrecoverable error is thrown', async () => {
    vi.mocked(octokit.fetchUserIssues).mockRejectedValue(new Error('network error'))
    const jobsService = makeJobsService()
    const service = new UsersService(makeModel() as never, makeModel() as never, makeModel() as never, jobsService as never, makeConfigService())

    await service.run('job-1', 'alice')

    expect(jobsService.markFailed).toHaveBeenCalledWith('job-1', 'network error')
    expect(jobsService.markDone).not.toHaveBeenCalled()
  })

  it('does NOT call listAccessibleRepos when no token is given', async () => {
    const service = makeService()
    await service.run('job-1', 'alice')
    expect(octokit.listAccessibleRepos).not.toHaveBeenCalled()
  })

  it('calls listAccessibleRepos when a token is provided', async () => {
    const service = makeService()
    await service.run('job-1', 'alice', 'ghp_mytoken')
    expect(octokit.listAccessibleRepos).toHaveBeenCalledOnce()
  })

  it('fetches comments for each discovered repo', async () => {
    vi.mocked(octokit.searchReposWithCommenter).mockResolvedValue([
      { owner: 'org', name: 'repo-a' },
      { owner: 'org', name: 'repo-b' },
    ])
    const service = makeService()
    await service.run('job-1', 'alice')
    expect(octokit.fetchAllComments).toHaveBeenCalledWith(expect.anything(), 'org', 'repo-a')
    expect(octokit.fetchAllComments).toHaveBeenCalledWith(expect.anything(), 'org', 'repo-b')
  })

  it('filters comments to only those authored by the target user', async () => {
    vi.mocked(octokit.searchReposWithCommenter).mockResolvedValue([{ owner: 'o', name: 'r' }])
    vi.mocked(octokit.fetchAllComments).mockResolvedValue([
      { username: 'alice', githubId: 1, type: 'pr_comment', body: '', path: null, diffHunk: null, pullRequestNumber: null, repoOwner: 'o', repoName: 'r', createdAt: '', updatedAt: '' },
      { username: 'bob',   githubId: 2, type: 'pr_comment', body: '', path: null, diffHunk: null, pullRequestNumber: null, repoOwner: 'o', repoName: 'r', createdAt: '', updatedAt: '' },
    ])
    const commentModel = makeModel()
    const service = new UsersService(makeModel() as never, makeModel() as never, commentModel as never, makeJobsService() as never, makeConfigService())

    await service.run('job-1', 'alice')

    expect(commentModel.findOneAndUpdate).toHaveBeenCalledOnce()
    expect(commentModel.findOneAndUpdate).toHaveBeenCalledWith(
      { githubId: 1 },
      expect.objectContaining({ username: 'alice', userId: 'alice' }),
      { upsert: true, new: true },
    )
  })

  it('fetches the diff for each PR', async () => {
    vi.mocked(octokit.fetchUserPullRequests).mockResolvedValue([
      { githubId: 20, number: 3, title: 'PR A', body: null, state: 'merged', authorLogin: 'alice', repoOwner: 'org', repoName: 'repo-a', labels: [], draft: false, createdAt: '', updatedAt: '', closedAt: null, mergedAt: null },
      { githubId: 21, number: 7, title: 'PR B', body: null, state: 'open',   authorLogin: 'alice', repoOwner: 'org', repoName: 'repo-b', labels: [], draft: false, createdAt: '', updatedAt: '', closedAt: null, mergedAt: null },
    ])
    const service = makeService()
    await service.run('job-1', 'alice')
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
    const service = new UsersService(makeModel() as never, prModel as never, makeModel() as never, makeJobsService() as never, makeConfigService())

    await service.run('job-1', 'alice')

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
    const service = new UsersService(makeModel() as never, prModel as never, makeModel() as never, makeJobsService() as never, makeConfigService())

    await expect(service.run('job-1', 'alice')).resolves.toBeUndefined()
    expect(prModel.findOneAndUpdate).toHaveBeenCalledTimes(2)
  })

  it('fetches comments ONLY from searchReposWithCommenter repos, not listAccessibleRepos-only repos', async () => {
    vi.mocked(octokit.searchReposWithCommenter).mockResolvedValue([
      { owner: 'org', name: 'public-commented' },
    ])
    vi.mocked(octokit.listAccessibleRepos).mockResolvedValue([
      { owner: 'org', name: 'private-no-comments' },
    ])
    const service = makeService()
    await service.run('job-1', 'alice', 'ghp_token')
    expect(octokit.fetchAllComments).toHaveBeenCalledTimes(1)
    expect(octokit.fetchAllComments).toHaveBeenCalledWith(expect.anything(), 'org', 'public-commented')
    expect(octokit.fetchAllComments).not.toHaveBeenCalledWith(expect.anything(), 'org', 'private-no-comments')
  })

  it('repos step count includes both search and accessible repos (deduplicated)', async () => {
    vi.mocked(octokit.searchReposWithCommenter).mockResolvedValue([
      { owner: 'org', name: 'shared' },
      { owner: 'org', name: 'public-only' },
    ])
    vi.mocked(octokit.listAccessibleRepos).mockResolvedValue([
      { owner: 'org', name: 'shared' },
      { owner: 'org', name: 'private-only' },
    ])
    const jobsService = makeJobsService()
    const service = new UsersService(makeModel() as never, makeModel() as never, makeModel() as never, jobsService as never, makeConfigService())
    await service.run('job-1', 'alice', 'ghp_token')
    // 3 unique repos total (shared deduped), but comments only for the 2 search repos
    expect(jobsService.updateStep).toHaveBeenCalledWith('job-1', 'repos', 'done', 3)
    expect(octokit.fetchAllComments).toHaveBeenCalledTimes(2)
  })
})
