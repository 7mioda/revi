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

  @Prop({ type: String, required: true })
  batchId!: string

  @Prop({ type: String, required: true })
  generatedAt!: string

  @Prop({ type: String, required: false, default: null, index: true })
  userId!: string | null

  @Prop({ type: String, required: false, default: null })
  username!: string | null

  @Prop({ type: String, required: false, default: null, index: true })
  dimension!: string | null
}

export const SkillSchema = SchemaFactory.createForClass(Skill)
