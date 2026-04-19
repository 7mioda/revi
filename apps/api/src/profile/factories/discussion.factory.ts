import type { DiscussionEntity } from '../entities/discussion.js'

export function buildDiscussion(overrides: Partial<DiscussionEntity> = {}): DiscussionEntity {
  return {
    id: '000000000000000000000001',
    githubId: 'D_abc123',
    title: 'Test discussion',
    body: null,
    repoOwner: 'alice',
    repoName: 'repo',
    authorLogin: 'alice',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    username: 'alice',
    userId: null,
    ...overrides,
  }
}
