import 'reflect-metadata'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'

export type DiscussionDocument = HydratedDocument<Discussion>

@Schema({ collection: 'discussions', timestamps: false })
export class Discussion {
  /** Global GraphQL node ID from GitHub — unique across all discussions. */
  @Prop({ type: String, required: true, unique: true, index: true })
  githubId!: string

  @Prop({ type: String, required: true })
  title!: string

  @Prop({ type: String, default: null })
  body!: string | null

  @Prop({ type: String, required: true })
  repoOwner!: string

  @Prop({ type: String, required: true })
  repoName!: string

  @Prop({ type: String, required: true })
  authorLogin!: string

  @Prop({ type: String, required: true })
  createdAt!: string

  @Prop({ type: String, required: true })
  updatedAt!: string

  /** GitHub login of the owning user. */
  @Prop({ type: String, required: false, default: null, index: true })
  username!: string | null

  /** Internal user ID if linked to a DB user record. */
  @Prop({ type: String, required: false, default: null })
  userId!: string | null
}

export const DiscussionSchema = SchemaFactory.createForClass(Discussion)
