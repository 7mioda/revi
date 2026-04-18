import 'reflect-metadata'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'

/** The three sequential steps executed by the profile sync pipeline. */
export const PROFILE_STEP_NAMES = ['fetchActivity', 'generatePreferences', 'generateCodingRules'] as const

export type ProfileStepName = typeof PROFILE_STEP_NAMES[number]
export type ProfileStepStatus = 'pending' | 'running' | 'done' | 'failed'
export type ProfileJobStatus = 'pending' | 'running' | 'done' | 'failed'

export type ProfileSyncJobDocument = HydratedDocument<ProfileSyncJob>

export interface ProfileJobStep {
  name: ProfileStepName
  status: ProfileStepStatus
  /** Number of records processed by this step. Set when status is 'done'. */
  count: number
}

@Schema({ collection: 'profile_sync_jobs', timestamps: false })
export class ProfileSyncJob {
  @Prop({ type: String, required: true, index: true })
  username!: string

  @Prop({ type: String, required: true, enum: ['pending', 'running', 'done', 'failed'], default: 'pending' })
  status!: ProfileJobStatus

  @Prop({ type: [{ name: String, status: String, count: Number }], required: true })
  steps!: ProfileJobStep[]

  @Prop({ type: String, required: true })
  createdAt!: string

  @Prop({ type: String, default: null })
  startedAt!: string | null

  @Prop({ type: String, default: null })
  completedAt!: string | null

  @Prop({ type: String, default: null })
  error!: string | null
}

export const ProfileSyncJobSchema = SchemaFactory.createForClass(ProfileSyncJob)
