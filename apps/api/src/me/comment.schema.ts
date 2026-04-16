import 'reflect-metadata'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'
import type { CommentType } from '@revi/octokit'

/** Mongoose document type for a persisted GitHub comment. */
export type CommentDocument = HydratedDocument<Comment>

/**
 * Mongoose schema for a normalised GitHub comment.
 * `githubId` is the unique key used for upserts — re-running the fetch
 * will update existing records rather than create duplicates.
 */
@Schema({ collection: 'comments', timestamps: false })
export class Comment {
  /** The numeric GitHub ID of the comment — unique across all sources. */
  @Prop({ required: true, unique: true, index: true })
  githubId!: number

  /** GitHub login of the comment author. */
  @Prop({ required: true })
  username!: string

  /** Discriminant: which GitHub API the comment came from. */
  @Prop({ required: true, enum: ['pr_review_comment', 'pr_comment', 'commit_comment'] })
  type!: CommentType

  /** Raw Markdown body. */
  @Prop({ required: true })
  body!: string

  /** File path (PR review comments only). */
  @Prop({ default: null })
  path!: string | null

  /** Raw diff hunk (PR review comments only). */
  @Prop({ default: null })
  diffHunk!: string | null

  /** Pull request number, if applicable. */
  @Prop({ default: null })
  pullRequestNumber!: number | null

  /** Repository owner login. */
  @Prop({ required: true })
  repoOwner!: string

  /** Repository name. */
  @Prop({ required: true })
  repoName!: string

  /** ISO 8601 creation timestamp from GitHub. */
  @Prop({ required: true })
  createdAt!: string

  /** ISO 8601 last-updated timestamp from GitHub. */
  @Prop({ required: true })
  updatedAt!: string
}

export const CommentSchema = SchemaFactory.createForClass(Comment)
