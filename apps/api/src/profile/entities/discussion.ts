export interface DiscussionEntity {
  id: string
  /** Global GraphQL node ID from GitHub — string, not numeric. */
  githubId: string
  title: string
  body: string | null
  repoOwner: string
  repoName: string
  authorLogin: string
  createdAt: string
  updatedAt: string
  username: string | null
  userId: string | null
}
