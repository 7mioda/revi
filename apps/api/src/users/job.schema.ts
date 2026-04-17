import 'reflect-metadata'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'

/** The four sequential steps executed by the activity pipeline. */
export const STEP_NAMES = ['issues', 'pullRequests', 'repos', 'comments'] as const

/** A single pipeline step name. */
export type StepName = typeof STEP_NAMES[number]

/** Status of an individual step or the overall job. */
export type StepStatus = 'pending' | 'running' | 'done' | 'failed'

/** Status of the overall job. */
export type JobStatus = 'pending' | 'running' | 'done' | 'failed'

/** Mongoose document type for a persisted activity job. */
export type ActivityJobDocument = HydratedDocument<ActivityJob>

/**
 * Represents the progress state of one pipeline step within an activity job.
 */
export interface JobStep {
  /** Step identifier. */
  name: StepName
  /** Current execution status of this step. */
  status: StepStatus
  /** Number of records upserted by this step. Set when status transitions to 'done'. */
  count: number
}

/**
 * Mongoose schema for a background activity-fetch job.
 *
 * A job is created when `POST /users/:username/activity` is called and
 * tracks the four-step pipeline (issues → pullRequests → repos → comments)
 * so clients can poll `GET /users/jobs/:id` to follow progress.
 */
@Schema({ collection: 'activity_jobs', timestamps: false })
export class ActivityJob {
  /** GitHub login of the user whose activity is being fetched. */
  @Prop({ type: String, required: true, index: true })
  username!: string

  /** Overall job status. */
  @Prop({
    type: String,
    required: true,
    enum: ['pending', 'running', 'done', 'failed'],
    default: 'pending',
  })
  status!: JobStatus

  /** Per-step progress. Always contains all four steps in STEP_NAMES order. */
  @Prop({
    type: [{ name: String, status: String, count: Number }],
    required: true,
  })
  steps!: JobStep[]

  /** ISO 8601 timestamp when the job was created. */
  @Prop({ type: String, required: true })
  createdAt!: string

  /** ISO 8601 timestamp when the job started running. Null until then. */
  @Prop({ type: String, default: null })
  startedAt!: string | null

  /** ISO 8601 timestamp when the job completed (done or failed). Null until then. */
  @Prop({ type: String, default: null })
  completedAt!: string | null

  /** Error message if the job failed. Null otherwise. */
  @Prop({ type: String, default: null })
  error!: string | null
}

export const ActivityJobSchema = SchemaFactory.createForClass(ActivityJob)
