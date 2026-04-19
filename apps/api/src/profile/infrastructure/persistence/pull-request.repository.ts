import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import type { Model } from 'mongoose'
import { PullRequest } from './pull-request.schema.js'
import type { PullRequestDocument } from './pull-request.schema.js'
import { PullRequestMapper } from '../mappers/pull-request.mapper.js'
import type { PullRequestEntity } from '../../entities/index.js'

export abstract class PullRequestRepository {
  abstract findByUsername(username: string): Promise<PullRequestEntity[]>
  abstract upsert(data: Omit<PullRequestEntity, 'id'>): Promise<void>
}

@Injectable()
export class PullRequestRepositoryMongo extends PullRequestRepository {
  constructor(
    @InjectModel(PullRequest.name) private readonly model: Model<PullRequestDocument>,
  ) {
    super()
  }

  async findByUsername(username: string): Promise<PullRequestEntity[]> {
    const docs = await this.model.find({ authorLogin: username }).lean()
    return docs.map((d) => PullRequestMapper.toEntity(d as PullRequestDocument))
  }

  async upsert(data: Omit<PullRequestEntity, 'id'>): Promise<void> {
    await this.model.findOneAndUpdate(
      { githubId: data.githubId },
      data,
      { upsert: true, new: true },
    ).exec()
  }
}
