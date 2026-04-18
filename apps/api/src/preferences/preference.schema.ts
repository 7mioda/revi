import 'reflect-metadata'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'

export type PreferenceDocument = HydratedDocument<Preference>

@Schema({ collection: 'preferences' })
export class Preference {
  @Prop({ type: String, required: true })
  name!: string

  /** One of the 5 PreferenceDimension keys. */
  @Prop({ type: String, required: true })
  dimension!: string

  @Prop({ type: String, required: true })
  content!: string

  @Prop({ type: [String], required: true })
  tags!: string[]

  /** One-sentence LLM summary of how this preference evolved over time. Null if insufficient data. */
  @Prop({ type: String, required: false, default: null })
  evolution!: string | null

  /** UUID shared by all preferences generated in the same batch. */
  @Prop({ type: String, required: true })
  batchId!: string

  /** ISO 8601 timestamp of when this batch was generated. */
  @Prop({ type: String, required: true })
  generatedAt!: string

  /** GitHub user ID of the owning user. Null for public/shared records. */
  @Prop({ type: String, required: false, default: null, index: true })
  userId!: string | null

  /** GitHub login of the owning user. */
  @Prop({ type: String, required: false, default: null })
  username!: string | null
}

export const PreferenceSchema = SchemaFactory.createForClass(Preference)
