import 'reflect-metadata'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'

export type PreferenceDocument = HydratedDocument<Preference>

@Schema({ collection: 'preferences', timestamps: false })
export class Preference {
  @Prop({ type: String, required: true })
  name!: string

  @Prop({ type: String, required: true })
  dimension!: string

  @Prop({ type: String, required: true })
  content!: string

  @Prop({ type: [String], required: true })
  tags!: string[]

  @Prop({ type: String, required: false, default: null })
  evolution!: string | null

  @Prop({ type: String, required: true })
  batchId!: string

  @Prop({ type: String, required: true })
  generatedAt!: string

  @Prop({ type: String, required: false, default: null, index: true })
  userId!: string | null

  @Prop({ type: String, required: false, default: null })
  username!: string | null
}

export const PreferenceSchema = SchemaFactory.createForClass(Preference)
