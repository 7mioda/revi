export interface ProfileEntity {
  id: string
  /** GitHub login — primary key. */
  username: string
  githubId: number
  avatarUrl: string | null
  name: string | null
  bio: string | null
  company: string | null
  location: string | null
  email: string | null
  blog: string | null
  twitterUsername: string | null
  followers: number
  following: number
  publicRepos: number
  /** ISO 8601 — when the GitHub account was created. */
  githubCreatedAt: string
  /** ISO 8601 — last successful sync. */
  syncedAt: string
  /** Number of times this profile has been used to run a review. */
  reviews: number
  /** Pixelized avatar hosted on Vercel Blob; null if not generated. */
  avatar: string | null
}
