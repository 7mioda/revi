import 'reflect-metadata'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'

/** Mongoose document type for a persisted GitHub pull request. */
export type PullRequestDocument = HydratedDocument<PullRequest>

/**
 * Mongoose schema for a GitHub pull request authored by the tracked user.
 * `githubId` is the unique key used for idempotent upserts.
 */
@Schema({ collection: 'pull_requests', timestamps: false })
export class PullRequest {
  /** The numeric GitHub ID of the pull request — unique across all repos. */
  @Prop({ type: Number, required: true, unique: true, index: true })
  githubId!: number

  /** PR number within its repository. */
  @Prop({ type: Number, required: true })
  number!: number

  /** PR title. */
  @Prop({ type: String, required: true })
  title!: string

  /** Raw Markdown body, or null if empty. */
  @Prop({ type: String, default: null })
  body!: string | null

  /** Current state: 'merged' is derived from mergedAt being set. */
  @Prop({ type: String, required: true, enum: ['open', 'closed', 'merged'] })
  state!: 'open' | 'closed' | 'merged'

  /** GitHub login of the PR author. */
  @Prop({ type: String, required: true })
  authorLogin!: string

  /** Repository owner login. */
  @Prop({ type: String, required: true })
  repoOwner!: string

  /** Repository name. */
  @Prop({ type: String, required: true })
  repoName!: string

  /** Label names applied to the PR. */
  @Prop({ type: [String], default: [] })
  labels!: string[]

  /** Whether the PR is a draft. */
  @Prop({ type: Boolean, required: true })
  draft!: boolean

  /** ISO 8601 creation timestamp. */
  @Prop({ type: String, required: true })
  createdAt!: string

  /** ISO 8601 last-updated timestamp. */
  @Prop({ type: String, required: true })
  updatedAt!: string

  /** ISO 8601 closed timestamp, or null if still open. */
  @Prop({ type: String, default: null })
  closedAt!: string | null

  /** ISO 8601 merged timestamp, or null if not merged. */
  @Prop({ type: String, default: null })
  mergedAt!: string | null

  /** Changed files with their unified diff patches. Populated by fetchPRDiff. */
  @Prop({ type: [{ filename: String, status: String, patch: String }], default: [] })
  files!: Array<{ filename: string; status: string; patch?: string }>

  /** GitHub login of the owning user this record belongs to. */
  @Prop({ type: String, required: false, default: null, index: true })
  userId!: string | null
}

export const PullRequestSchema = SchemaFactory.createForClass(PullRequest)
