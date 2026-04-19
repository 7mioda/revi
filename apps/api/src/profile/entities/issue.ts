export interface IssueEntity {
  id: string
  /** Numeric GitHub ID — unique across all repos. */
  githubId: number
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  authorLogin: string
  repoOwner: string
  repoName: string
  labels: string[]
  createdAt: string
  updatedAt: string
  closedAt: string | null
  userId: string | null
}
