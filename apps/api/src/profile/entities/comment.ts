import type { CommentType } from '@revi/octokit'

export interface CommentEntity {
  id: string
  githubId: number
  username: string
  type: CommentType
  body: string
  path: string | null
  diffHunk: string | null
  pullRequestNumber: number | null
  repoOwner: string
  repoName: string
  createdAt: string
  updatedAt: string
  userId: string | null
}
