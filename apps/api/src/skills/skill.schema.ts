import 'reflect-metadata'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'

export type SkillDocument = HydratedDocument<Skill>

@Schema({ collection: 'skills' })
export class Skill {
  @Prop({ type: String, required: true })
  name!: string

  @Prop({ type: String, required: true })
  content!: string

  @Prop({ type: [String], required: true })
  tags!: string[]

  /** UUID shared by all skills generated in the same batch. */
  @Prop({ type: String, required: true })
  batchId!: string

  /** ISO 8601 timestamp of when this batch was generated. */
  @Prop({ type: String, required: true })
  generatedAt!: string

  /** GitHub login of the owning user. Null for public/shared records. */
  @Prop({ type: String, required: false, default: null, index: true })
  userId!: string | null

  /** GitHub login / display name of the owning user. */
  @Prop({ type: String, required: false, default: null })
  username!: string | null

  /** Skill dimension key (e.g. 'review-style'). Null for legacy records. */
  @Prop({ type: String, required: false, default: null, index: true })
  dimension!: string | null
}

export const SkillSchema = SchemaFactory.createForClass(Skill)
