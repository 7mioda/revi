import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import type { Model } from 'mongoose'
import { Issue } from './issue.schema.js'
import type { IssueDocument } from './issue.schema.js'
import { IssueMapper } from '../mappers/issue.mapper.js'
import type { IssueEntity } from '../../entities/index.js'

export abstract class IssueRepository {
  abstract findByUsername(username: string): Promise<IssueEntity[]>
  abstract upsert(data: Omit<IssueEntity, 'id'>): Promise<void>
}

@Injectable()
export class IssueRepositoryMongo extends IssueRepository {
  constructor(
    @InjectModel(Issue.name) private readonly model: Model<IssueDocument>,
  ) {
    super()
  }

  async findByUsername(username: string): Promise<IssueEntity[]> {
    const docs = await this.model.find({ username: { $in: [username] } }).lean()
    return docs.map((d) => IssueMapper.toEntity(d as IssueDocument))
  }

  async upsert(data: Omit<IssueEntity, 'id'>): Promise<void> {
    await this.model.findOneAndUpdate(
      { githubId: data.githubId },
      data,
      { upsert: true, new: true },
    ).exec()
  }
}
