import { buildComment } from '../factories/comment.factory.js'
import type { CommentEntity } from '../entities/index.js'

export const fixtureComment: CommentEntity = buildComment({
  id: 'comment-1',
  githubId: 3001,
  username: 'alice',
  body: 'This approach could cause a race condition. Consider using a mutex.',
  type: 'pr_review_comment',
  repoOwner: 'acme',
  repoName: 'backend',
})
