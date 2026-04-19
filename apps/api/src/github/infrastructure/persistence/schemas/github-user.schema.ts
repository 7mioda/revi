import 'reflect-metadata'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'

export type GithubUserDocument = HydratedDocument<GithubUser>

@Schema({ collection: 'github_users', timestamps: false })
export class GithubUser {
  @Prop({ type: Number, required: true, unique: true, index: true })
  githubUserId!: number

  @Prop({ type: String, required: true })
  login!: string

  @Prop({ type: String, required: true })
  accessTokenEncrypted!: string

  /** Null when the GitHub App does not have expiring user tokens enabled. */
  @Prop({ type: String, default: null })
  refreshTokenEncrypted!: string | null

  @Prop({ type: Date, default: null })
  accessTokenExpiresAt!: Date | null

  @Prop({ type: Date, default: null })
  refreshTokenExpiresAt!: Date | null

  /** Links this user to the installation they authorized through. */
  @Prop({ type: Number, default: null })
  installationId!: number | null
}

export const GithubUserSchema = SchemaFactory.createForClass(GithubUser)
