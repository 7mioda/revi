import type { ProfileEntity, ProfileJobEntity, SkillEntity, PreferenceEntity } from '../../entities/index.js'

export interface GetProfileOutput {
  profile: ProfileEntity
}

export interface GetProfileJobOutput {
  job: ProfileJobEntity
}

export interface ListProfilesOutput {
  profiles: ProfileEntity[]
}

export interface GetActivitySummaryOutput {
  profileSyncs: Array<{ completedAt: string | null; steps: Array<{ name: string; count: number }> }>
  skillsGenerated: number
  preferencesGenerated: number
  reviewsTotal: number
}

export interface GetPersonaContextOutput {
  profile: ProfileEntity
  skills: SkillEntity[]
  preferences: PreferenceEntity[]
}
