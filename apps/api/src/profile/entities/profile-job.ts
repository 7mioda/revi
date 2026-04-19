import type { ProfileJobStepName, ProfileJobStepStatus, ProfileJobStatus } from '../infrastructure/persistence/profile-job.schema.js'

export interface ProfileJobStepEntity {
  name: ProfileJobStepName
  status: ProfileJobStepStatus
  count: number
}

export interface ProfileJobEntity {
  id: string
  username: string
  status: ProfileJobStatus
  steps: ProfileJobStepEntity[]
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  error: string | null
}
