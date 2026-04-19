import 'reflect-metadata'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'

export type InstallationDocument = HydratedDocument<Installation>

@Schema({ collection: 'github_installations', timestamps: false })
export class Installation {
  @Prop({ type: Number, required: true, unique: true, index: true })
  installationId!: number

  @Prop({ type: String, required: true })
  accountLogin!: string

  @Prop({ type: String, required: true })
  accountType!: string

  @Prop({ type: Date, required: true, default: () => new Date() })
  createdAt!: Date

  @Prop({ type: Object, required: true })
  rawJson!: Record<string, unknown>
}

export const InstallationSchema = SchemaFactory.createForClass(Installation)
