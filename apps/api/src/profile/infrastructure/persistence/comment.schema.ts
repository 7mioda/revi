import 'reflect-metadata'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'
import type { CommentType } from '@revi/octokit'

export type CommentDocument = HydratedDocument<Comment>

@Schema({ collection: 'comments', timestamps: false })
export class Comment {
  @Prop({ type: Number, required: true, unique: true, index: true })
  githubId!: number

  @Prop({ type: String, required: true })
  username!: string

  @Prop({ type: String, required: true, enum: ['pr_review_comment', 'pr_comment', 'commit_comment'] })
  type!: CommentType

  @Prop({ type: String, required: true })
  body!: string

  @Prop({ type: String, default: null })
  path!: string | null

  @Prop({ type: String, default: null })
  diffHunk!: string | null

  @Prop({ type: Number, default: null })
  pullRequestNumber!: number | null

  @Prop({ type: String, required: true })
  repoOwner!: string

  @Prop({ type: String, required: true })
  repoName!: string

  @Prop({ type: String, required: true })
  createdAt!: string

  @Prop({ type: String, required: true })
  updatedAt!: string

  @Prop({ type: String, required: false, default: null, index: true })
  userId!: string | null
}

export const CommentSchema = SchemaFactory.createForClass(Comment)
