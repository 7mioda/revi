import 'reflect-metadata'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'

export type IssueDocument = HydratedDocument<Issue>

@Schema({ collection: 'issues', timestamps: false })
export class Issue {
  @Prop({ type: Number, required: true, unique: true, index: true })
  githubId!: number

  @Prop({ type: Number, required: true })
  number!: number

  @Prop({ type: String, required: true })
  title!: string

  @Prop({ type: String, default: null })
  body!: string | null

  @Prop({ type: String, required: true, enum: ['open', 'closed'] })
  state!: 'open' | 'closed'

  @Prop({ type: String, required: true })
  authorLogin!: string

  @Prop({ type: String, required: true })
  repoOwner!: string

  @Prop({ type: String, required: true })
  repoName!: string

  @Prop({ type: [String], default: [] })
  labels!: string[]

  @Prop({ type: String, required: true })
  createdAt!: string

  @Prop({ type: String, required: true })
  updatedAt!: string

  @Prop({ type: String, default: null })
  closedAt!: string | null

  @Prop({ type: String, required: false, default: null, index: true })
  userId!: string | null
}

export const IssueSchema = SchemaFactory.createForClass(Issue)
