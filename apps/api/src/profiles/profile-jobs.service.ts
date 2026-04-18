import 'reflect-metadata'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import type { Model } from 'mongoose'
import { ProfileSyncJob, PROFILE_STEP_NAMES } from './profile-sync-job.schema.js'
import type { ProfileStepName, ProfileStepStatus, ProfileJobStatus } from './profile-sync-job.schema.js'

@Injectable()
export class ProfileJobsService {
  constructor(
    @InjectModel(ProfileSyncJob.name)
    private readonly jobModel: Model<ProfileSyncJob>,
  ) {}

  async create(username: string): Promise<ProfileSyncJob & { _id: unknown }> {
    return this.jobModel.create({
      username,
      status: 'pending' satisfies ProfileJobStatus,
      steps: PROFILE_STEP_NAMES.map((name) => ({ name, status: 'pending' satisfies ProfileStepStatus, count: 0 })),
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      error: null,
    })
  }

  async markRunning(jobId: string): Promise<void> {
    await this.jobModel.findByIdAndUpdate(jobId, {
      status: 'running' satisfies ProfileJobStatus,
      startedAt: new Date().toISOString(),
    })
  }

  async updateStep(jobId: string, name: ProfileStepName, status: ProfileStepStatus, count?: number): Promise<void> {
    const set: Record<string, unknown> = { 'steps.$.status': status }
    if (count !== undefined) {
      set['steps.$.count'] = count
    }
    await this.jobModel.updateOne(
      { _id: jobId, 'steps.name': name },
      { $set: set },
    )
  }

  async markDone(jobId: string): Promise<void> {
    await this.jobModel.findByIdAndUpdate(jobId, {
      status: 'done' satisfies ProfileJobStatus,
      completedAt: new Date().toISOString(),
    })
  }

  async markFailed(jobId: string, error: string): Promise<void> {
    await this.jobModel.findByIdAndUpdate(jobId, {
      status: 'failed' satisfies ProfileJobStatus,
      completedAt: new Date().toISOString(),
      error,
    })
  }

  async findById(jobId: string): Promise<ProfileSyncJob | null> {
    return this.jobModel.findById(jobId).lean()
  }
}
