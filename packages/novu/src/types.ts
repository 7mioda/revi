/** Novu workflow identifiers used by this app. */
export type NotificationEvent = 'profile-sync-done' | 'profile-sync-failed'

/** Payload sent with every notification trigger. */
export interface NotificationPayload {
  /** MongoDB ObjectId string of the sync job. */
  jobId: string
  /** GitHub username that was synced. */
  username: string
  /** Human-readable outcome message. */
  message: string
}
