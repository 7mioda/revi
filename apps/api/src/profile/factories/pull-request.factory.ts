import type { PullRequestEntity } from '../entities/pull-request.js'

export function buildPullRequest(overrides: Partial<PullRequestEntity> = {}): PullRequestEntity {
  return {
    id: '000000000000000000000001',
    githubId: 1,
    number: 1,
    title: 'Test PR',
    body: null,
    state: 'open',
    authorLogin: 'alice',
    repoOwner: 'alice',
    repoName: 'repo',
    labels: [],
    draft: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    closedAt: null,
    mergedAt: null,
    files: [],
    userId: null,
    ...overrides,
  }
}
