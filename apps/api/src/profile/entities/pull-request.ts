export interface PullRequestEntity {
  id: string
  /** Numeric GitHub ID — unique across all repos. */
  githubId: number
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed' | 'merged'
  authorLogin: string
  repoOwner: string
  repoName: string
  labels: string[]
  draft: boolean
  createdAt: string
  updatedAt: string
  closedAt: string | null
  mergedAt: string | null
  files: Array<{ filename: string; status: string; patch?: string }>
  userId: string | null
}
