import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import type { Model } from 'mongoose'
import { Preference } from './preference.schema.js'
import type { PreferenceDocument } from './preference.schema.js'
import { PreferenceMapper } from '../mappers/preference.mapper.js'
import type { PreferenceEntity } from '../../entities/index.js'

export abstract class PreferenceRepository {
  abstract findByUserId(userId: string): Promise<PreferenceEntity[]>
  abstract findByUsername(username: string): Promise<PreferenceEntity[]>
  abstract save(pref: Omit<PreferenceEntity, 'id'>): Promise<PreferenceEntity>
  abstract deleteManyByUserId(userId: string): Promise<void>
  abstract countGeneratedAfter(username: string, since: string): Promise<number>
}

@Injectable()
export class PreferenceRepositoryMongo extends PreferenceRepository {
  constructor(
    @InjectModel(Preference.name) private readonly model: Model<PreferenceDocument>,
  ) {
    super()
  }

  async findByUserId(userId: string): Promise<PreferenceEntity[]> {
    const docs = await this.model.find({ userId }).lean()
    return docs.map((d) => PreferenceMapper.toEntity(d as PreferenceDocument))
  }

  async findByUsername(username: string): Promise<PreferenceEntity[]> {
    const docs = await this.model.find({ username }).lean()
    return docs.map((d) => PreferenceMapper.toEntity(d as PreferenceDocument))
  }

  async save(pref: Omit<PreferenceEntity, 'id'>): Promise<PreferenceEntity> {
    const doc = await this.model.create(pref)
    return PreferenceMapper.toEntity(doc as unknown as PreferenceDocument)
  }

  async deleteManyByUserId(userId: string): Promise<void> {
    await this.model.deleteMany({ userId }).exec()
  }

  async countGeneratedAfter(username: string, since: string): Promise<number> {
    return this.model.countDocuments({ username, generatedAt: { $gt: since } }).exec()
  }
}
