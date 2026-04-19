import { buildIssue } from '../factories/issue.factory.js'
import type { IssueEntity } from '../entities/index.js'

export const fixtureIssue: IssueEntity = buildIssue({
  id: 'issue-1',
  githubId: 1001,
  number: 42,
  title: 'Fix memory leak in websocket handler',
  authorLogin: 'alice',
  repoOwner: 'acme',
  repoName: 'backend',
})
