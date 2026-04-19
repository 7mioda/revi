import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import type { Model } from 'mongoose'
import { Profile } from './profile.schema.js'
import type { ProfileDocument } from './profile.schema.js'
import { ProfileMapper } from '../mappers/profile.mapper.js'
import type { ProfileEntity } from '../../entities/index.js'

export abstract class ProfileRepository {
  abstract findByUsername(username: string): Promise<ProfileEntity | null>
  abstract findById(id: string): Promise<ProfileEntity | null>
  abstract list(): Promise<ProfileEntity[]>
  abstract upsert(data: Omit<ProfileEntity, 'id'>): Promise<ProfileEntity>
  abstract update(id: string, data: Partial<Omit<ProfileEntity, 'id'>>): Promise<void>
  abstract incrementReviews(id: string): Promise<void>
  abstract delete(id: string): Promise<void>
}

@Injectable()
export class ProfileRepositoryMongo extends ProfileRepository {
  constructor(
    @InjectModel(Profile.name) private readonly model: Model<ProfileDocument>,
  ) {
    super()
  }

  async findByUsername(username: string): Promise<ProfileEntity | null> {
    const doc = await this.model.findOne({ username }).lean()
    return doc ? ProfileMapper.toEntity(doc as ProfileDocument) : null
  }

  async findById(id: string): Promise<ProfileEntity | null> {
    const doc = await this.model.findById(id).lean()
    return doc ? ProfileMapper.toEntity(doc as ProfileDocument) : null
  }

  async list(): Promise<ProfileEntity[]> {
    const docs = await this.model.find().sort({ followers: -1 }).lean()
    return docs.map((d) => ProfileMapper.toEntity(d as ProfileDocument))
  }

  async upsert(data: Omit<ProfileEntity, 'id'>): Promise<ProfileEntity> {
    const doc = await this.model.findOneAndUpdate(
      { username: data.username },
      data,
      { upsert: true, new: true },
    ).lean()
    return ProfileMapper.toEntity(doc as ProfileDocument)
  }

  async update(id: string, data: Partial<Omit<ProfileEntity, 'id'>>): Promise<void> {
    await this.model.findByIdAndUpdate(id, data).exec()
  }

  async incrementReviews(id: string): Promise<void> {
    await this.model.updateOne({ _id: id }, { $inc: { reviews: 1 } }).exec()
  }

  async delete(id: string): Promise<void> {
    await this.model.findByIdAndDelete(id).exec()
  }
}
