import type { IssueEntity } from '../entities/issue.js'

export function buildIssue(overrides: Partial<IssueEntity> = {}): IssueEntity {
  return {
    id: '000000000000000000000001',
    githubId: 1,
    number: 1,
    title: 'Test issue',
    body: null,
    state: 'open',
    authorLogin: 'alice',
    repoOwner: 'alice',
    repoName: 'repo',
    labels: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    closedAt: null,
    userId: null,
    ...overrides,
  }
}
