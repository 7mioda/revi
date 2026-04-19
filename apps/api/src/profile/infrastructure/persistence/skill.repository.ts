import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import type { Model } from 'mongoose'
import { Skill } from './skill.schema.js'
import type { SkillDocument } from './skill.schema.js'
import { SkillMapper } from '../mappers/skill.mapper.js'
import type { SkillEntity } from '../../entities/index.js'

export abstract class SkillRepository {
  abstract findByUserId(userId: string): Promise<SkillEntity[]>
  abstract findByUsername(username: string): Promise<SkillEntity[]>
  abstract findById(id: string): Promise<SkillEntity | null>
  abstract save(skill: Omit<SkillEntity, 'id'>): Promise<SkillEntity>
  abstract deleteManyByUserId(userId: string): Promise<void>
  abstract countGeneratedAfter(username: string, since: string): Promise<number>
  /** Upsert a coding-rule skill by (username, dimension, batchId) — used during incremental generation. */
  abstract upsertByDimension(data: Omit<SkillEntity, 'id'>): Promise<void>
}

@Injectable()
export class SkillRepositoryMongo extends SkillRepository {
  constructor(
    @InjectModel(Skill.name) private readonly model: Model<SkillDocument>,
  ) {
    super()
  }

  async findByUserId(userId: string): Promise<SkillEntity[]> {
    const docs = await this.model.find({ userId }).lean()
    return docs.map((d) => SkillMapper.toEntity(d as SkillDocument))
  }

  async findByUsername(username: string): Promise<SkillEntity[]> {
    const docs = await this.model.find({ username }).lean()
    return docs.map((d) => SkillMapper.toEntity(d as SkillDocument))
  }

  async findById(id: string): Promise<SkillEntity | null> {
    const doc = await this.model.findById(id).lean()
    return doc ? SkillMapper.toEntity(doc as SkillDocument) : null
  }

  async save(skill: Omit<SkillEntity, 'id'>): Promise<SkillEntity> {
    const doc = await this.model.create(skill)
    return SkillMapper.toEntity(doc as unknown as SkillDocument)
  }

  async deleteManyByUserId(userId: string): Promise<void> {
    await this.model.deleteMany({ userId }).exec()
  }

  async countGeneratedAfter(username: string, since: string): Promise<number> {
    return this.model.countDocuments({ username, generatedAt: { $gt: since } }).exec()
  }

  async upsertByDimension(data: Omit<SkillEntity, 'id'>): Promise<void> {
    await this.model.findOneAndUpdate(
      { username: data.username, dimension: data.dimension, batchId: data.batchId },
      {
        $set: { name: data.name, content: data.content, tags: data.tags },
        $setOnInsert: {
          batchId: data.batchId,
          generatedAt: data.generatedAt,
          userId: data.userId,
          username: data.username,
          dimension: data.dimension,
        },
      },
      { upsert: true, new: true },
    ).exec()
  }
}
