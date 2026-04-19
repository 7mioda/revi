import { buildPullRequest } from '../factories/pull-request.factory.js'
import type { PullRequestEntity } from '../entities/index.js'

export const fixturePullRequest: PullRequestEntity = buildPullRequest({
  id: 'pr-1',
  githubId: 2001,
  number: 7,
  title: 'Add rate limiting to API endpoints',
  authorLogin: 'alice',
  repoOwner: 'acme',
  repoName: 'backend',
  state: 'merged',
})
