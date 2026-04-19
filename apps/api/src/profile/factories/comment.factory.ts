import type { CommentEntity } from '../entities/comment.js'

export function buildComment(overrides: Partial<CommentEntity> = {}): CommentEntity {
  return {
    id: '000000000000000000000001',
    githubId: 1,
    username: 'alice',
    type: 'pr_review_comment',
    body: 'looks good',
    path: null,
    diffHunk: null,
    pullRequestNumber: null,
    repoOwner: 'alice',
    repoName: 'repo',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    userId: null,
    ...overrides,
  }
}
