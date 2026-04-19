import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import type { Model } from 'mongoose'
import { ProfileJob, PROFILE_JOB_STEP_NAMES } from './profile-job.schema.js'
import type { ProfileJobDocument, ProfileJobStepName, ProfileJobStepStatus } from './profile-job.schema.js'
import { ProfileJobMapper } from '../mappers/profile-job.mapper.js'
import type { ProfileJobEntity } from '../../entities/index.js'

export abstract class ProfileJobRepository {
  abstract create(username: string): Promise<ProfileJobEntity>
  abstract findById(id: string): Promise<ProfileJobEntity | null>
  abstract markRunning(id: string): Promise<void>
  abstract updateStep(id: string, name: ProfileJobStepName, status: ProfileJobStepStatus, count?: number): Promise<void>
  abstract markDone(id: string): Promise<void>
  abstract markFailed(id: string, error: string): Promise<void>
  abstract findCompletedAfter(username: string, since: string): Promise<ProfileJobEntity[]>
}

@Injectable()
export class ProfileJobRepositoryMongo extends ProfileJobRepository {
  constructor(
    @InjectModel(ProfileJob.name) private readonly model: Model<ProfileJobDocument>,
  ) {
    super()
  }

  async create(username: string): Promise<ProfileJobEntity> {
    const doc = await this.model.create({
      username,
      status: 'pending',
      steps: PROFILE_JOB_STEP_NAMES.map((name) => ({ name, status: 'pending', count: 0 })),
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      error: null,
    })
    return ProfileJobMapper.toEntity(doc as unknown as ProfileJobDocument)
  }

  async findById(id: string): Promise<ProfileJobEntity | null> {
    const doc = await this.model.findById(id).lean()
    return doc ? ProfileJobMapper.toEntity(doc as ProfileJobDocument) : null
  }

  async markRunning(id: string): Promise<void> {
    await this.model.findByIdAndUpdate(id, {
      status: 'running',
      startedAt: new Date().toISOString(),
    }).exec()
  }

  async updateStep(id: string, name: ProfileJobStepName, status: ProfileJobStepStatus, count?: number): Promise<void> {
    const set: Record<string, unknown> = { 'steps.$.status': status }
    if (count !== undefined) set['steps.$.count'] = count
    await this.model.updateOne(
      { _id: id, 'steps.name': name },
      { $set: set },
    ).exec()
  }

  async markDone(id: string): Promise<void> {
    await this.model.findByIdAndUpdate(id, {
      status: 'done',
      completedAt: new Date().toISOString(),
    }).exec()
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.model.findByIdAndUpdate(id, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      error,
    }).exec()
  }

  async findCompletedAfter(username: string, since: string): Promise<ProfileJobEntity[]> {
    const docs = await this.model
      .find({ username, status: 'done', completedAt: { $gt: since } })
      .lean()
    return docs.map((d) => ProfileJobMapper.toEntity(d as ProfileJobDocument))
  }
}
