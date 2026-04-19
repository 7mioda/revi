import 'reflect-metadata'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'

export type PullRequestDocument = HydratedDocument<PullRequest>

@Schema({ collection: 'pull_requests', timestamps: false })
export class PullRequest {
  @Prop({ type: Number, required: true, unique: true, index: true })
  githubId!: number

  @Prop({ type: Number, required: true })
  number!: number

  @Prop({ type: String, required: true })
  title!: string

  @Prop({ type: String, default: null })
  body!: string | null

  @Prop({ type: String, required: true, enum: ['open', 'closed', 'merged'] })
  state!: 'open' | 'closed' | 'merged'

  @Prop({ type: String, required: true })
  authorLogin!: string

  @Prop({ type: String, required: true })
  repoOwner!: string

  @Prop({ type: String, required: true })
  repoName!: string

  @Prop({ type: [String], default: [] })
  labels!: string[]

  @Prop({ type: Boolean, required: true })
  draft!: boolean

  @Prop({ type: String, required: true })
  createdAt!: string

  @Prop({ type: String, required: true })
  updatedAt!: string

  @Prop({ type: String, default: null })
  closedAt!: string | null

  @Prop({ type: String, default: null })
  mergedAt!: string | null

  @Prop({ type: [{ filename: String, status: String, patch: String }], default: [] })
  files!: Array<{ filename: string; status: string; patch?: string }>

  @Prop({ type: String, required: false, default: null, index: true })
  userId!: string | null
}

export const PullRequestSchema = SchemaFactory.createForClass(PullRequest)
