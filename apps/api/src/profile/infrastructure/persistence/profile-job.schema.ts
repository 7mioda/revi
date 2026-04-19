import 'reflect-metadata'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'

export const PROFILE_JOB_STEP_NAMES = ['fetchActivity', 'generatePreferences', 'generateCodingRules'] as const

export type ProfileJobStepName = typeof PROFILE_JOB_STEP_NAMES[number]
export type ProfileJobStepStatus = 'pending' | 'running' | 'done' | 'failed'
export type ProfileJobStatus = 'pending' | 'running' | 'done' | 'failed'

export type ProfileJobDocument = HydratedDocument<ProfileJob>

export interface ProfileJobStep {
  name: ProfileJobStepName
  status: ProfileJobStepStatus
  count: number
}

@Schema({ collection: 'profile_jobs', timestamps: false })
export class ProfileJob {
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

export const ProfileJobSchema = SchemaFactory.createForClass(ProfileJob)
