import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import type { Model } from 'mongoose'
import { Discussion } from './discussion.schema.js'
import type { DiscussionDocument } from './discussion.schema.js'
import { DiscussionMapper } from '../mappers/discussion.mapper.js'
import type { DiscussionEntity } from '../../entities/index.js'

export abstract class DiscussionRepository {
  abstract findByUsername(username: string): Promise<DiscussionEntity[]>
  abstract upsert(data: Omit<DiscussionEntity, 'id'>): Promise<void>
}

@Injectable()
export class DiscussionRepositoryMongo extends DiscussionRepository {
  constructor(
    @InjectModel(Discussion.name) private readonly model: Model<DiscussionDocument>,
  ) {
    super()
  }

  async findByUsername(username: string): Promise<DiscussionEntity[]> {
    const docs = await this.model.find({ username }).lean()
    return docs.map((d) => DiscussionMapper.toEntity(d as DiscussionDocument))
  }

  async upsert(data: Omit<DiscussionEntity, 'id'>): Promise<void> {
    await this.model.findOneAndUpdate(
      { githubId: data.githubId },
      data,
      { upsert: true, new: true },
    ).exec()
  }
}
