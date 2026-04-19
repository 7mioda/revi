export type CommentType = 'pr_review_comment' | 'pr_comment' | 'commit_comment'

export interface PrComment {
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
  inReplyToId?: number
}

export interface Rule {
  name: string    // kebab-case identifier
  content: string // 1-3 sentence actionable description
}

export interface Category {
  topicId: number
  label: string       // short topic name from LLM
  description: string // 1-sentence summary from LLM
  keywords: string[]  // 3-5 keywords from LLM
  comments: PrComment[]
}

export interface FilterResult {
  relevant: PrComment[]
  skippedPreFilter: number
  skippedByLlm: number
  total: number
}
