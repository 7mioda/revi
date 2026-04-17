import 'reflect-metadata'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'

/** Mongoose document type for a persisted GitHub issue. */
export type IssueDocument = HydratedDocument<Issue>

/**
 * Mongoose schema for a GitHub issue authored by the tracked user.
 * `githubId` is the unique key used for idempotent upserts.
 */
@Schema({ collection: 'issues', timestamps: false })
export class Issue {
  /** The numeric GitHub ID of the issue — unique across all repos. */
  @Prop({ type: Number, required: true, unique: true, index: true })
  githubId!: number

  /** Issue number within its repository. */
  @Prop({ type: Number, required: true })
  number!: number

  /** Issue title. */
  @Prop({ type: String, required: true })
  title!: string

  /** Raw Markdown body, or null if empty. */
  @Prop({ type: String, default: null })
  body!: string | null

  /** Current state of the issue. */
  @Prop({ type: String, required: true, enum: ['open', 'closed'] })
  state!: 'open' | 'closed'

  /** GitHub login of the issue author. */
  @Prop({ type: String, required: true })
  authorLogin!: string

  /** Repository owner login. */
  @Prop({ type: String, required: true })
  repoOwner!: string

  /** Repository name. */
  @Prop({ type: String, required: true })
  repoName!: string

  /** Label names applied to the issue. */
  @Prop({ type: [String], default: [] })
  labels!: string[]

  /** ISO 8601 creation timestamp. */
  @Prop({ type: String, required: true })
  createdAt!: string

  /** ISO 8601 last-updated timestamp. */
  @Prop({ type: String, required: true })
  updatedAt!: string

  /** ISO 8601 closed timestamp, or null if still open. */
  @Prop({ type: String, default: null })
  closedAt!: string | null

  /** GitHub login of the owning user this record belongs to. */
  @Prop({ type: String, required: false, default: null, index: true })
  userId!: string | null
}

export const IssueSchema = SchemaFactory.createForClass(Issue)
