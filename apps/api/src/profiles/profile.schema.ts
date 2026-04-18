import 'reflect-metadata'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'

export type ProfileDocument = HydratedDocument<Profile>

@Schema({ collection: 'profiles', timestamps: false })
export class Profile {
  /** GitHub login — primary key for the profile. */
  @Prop({ type: String, required: true, unique: true, index: true })
  username!: string

  @Prop({ type: Number, required: true })
  githubId!: number

  @Prop({ type: String, default: null })
  avatarUrl!: string | null

  /** Display name (may differ from login). */
  @Prop({ type: String, default: null })
  name!: string | null

  @Prop({ type: String, default: null })
  bio!: string | null

  @Prop({ type: String, default: null })
  company!: string | null

  @Prop({ type: String, default: null })
  location!: string | null

  @Prop({ type: String, default: null })
  email!: string | null

  @Prop({ type: String, default: null })
  blog!: string | null

  @Prop({ type: String, default: null })
  twitterUsername!: string | null

  @Prop({ type: Number, default: 0 })
  followers!: number

  @Prop({ type: Number, default: 0 })
  following!: number

  @Prop({ type: Number, default: 0 })
  publicRepos!: number

  /** ISO 8601 timestamp when the GitHub account was created. */
  @Prop({ type: String, required: true })
  githubCreatedAt!: string

  /** ISO 8601 timestamp of the last successful sync. */
  @Prop({ type: String, required: true })
  syncedAt!: string

  /** Number of times this profile has been used to run a review. */
  @Prop({ type: Number, default: 0 })
  reviews!: number
}

export const ProfileSchema = SchemaFactory.createForClass(Profile)
