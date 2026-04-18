export interface Profile {
  username: string
  name: string | null
  avatarUrl: string | null
  bio: string | null
  followers: number
}

export type StepStatus = 'pending' | 'running' | 'done' | 'failed'

export interface SyncStep {
  name: string
  status: StepStatus
  count?: number
  error?: string
}

export interface SyncJob {
  status: 'pending' | 'running' | 'done' | 'failed'
  steps: SyncStep[]
}

export type SyncState =
  | { phase: 'enter-token' }
  | { phase: 'syncing'; jobId: string; username: string; job: SyncJob | null }
  | { phase: 'done'; username: string }
  | { phase: 'error'; message: string }

export const STEP_LABELS: Record<string, string> = {
  fetchActivity: 'Fetching GitHub activity',
  generatePreferences: 'Building preferences',
  generateCodingRules: 'Generating coding rules',
}
