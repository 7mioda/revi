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
}

export const SkillSchema = SchemaFactory.createForClass(Skill)
