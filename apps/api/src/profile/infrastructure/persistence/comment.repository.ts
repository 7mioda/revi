import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import type { Model } from 'mongoose'
import { Comment } from './comment.schema.js'
import type { CommentDocument } from './comment.schema.js'
import { CommentMapper } from '../mappers/comment.mapper.js'
import type { CommentEntity } from '../../entities/index.js'

export abstract class CommentRepository {
  abstract findByUserId(userId: string): Promise<CommentEntity[]>
  abstract findByUsername(username: string): Promise<CommentEntity[]>
  abstract upsert(data: Omit<CommentEntity, 'id'>): Promise<void>
}

@Injectable()
export class CommentRepositoryMongo extends CommentRepository {
  constructor(
    @InjectModel(Comment.name) private readonly model: Model<CommentDocument>,
  ) {
    super()
  }

  async findByUserId(userId: string): Promise<CommentEntity[]> {
    const docs = await this.model.find({ userId }).lean()
    return docs.map((d) => CommentMapper.toEntity(d as CommentDocument))
  }

  async findByUsername(username: string): Promise<CommentEntity[]> {
    const docs = await this.model.find({ username }).lean()
    return docs.map((d) => CommentMapper.toEntity(d as CommentDocument))
  }

  async upsert(data: Omit<CommentEntity, 'id'>): Promise<void> {
    await this.model.findOneAndUpdate(
      { githubId: data.githubId },
      data,
      { upsert: true, new: true },
    ).exec()
  }
}
