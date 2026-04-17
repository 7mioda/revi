import 'reflect-metadata'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import type { Model } from 'mongoose'
import { ActivityJob, STEP_NAMES } from './job.schema.js'
import type { StepName, StepStatus, JobStatus } from './job.schema.js'

/**
 * Manages the lifecycle of `ActivityJob` documents.
 *
 * All writes use targeted MongoDB update operators so concurrent reads
 * always see the latest per-step state without full-document overwrites.
 */
@Injectable()
export class JobsService {
  constructor(
    @InjectModel(ActivityJob.name)
    private readonly jobModel: Model<ActivityJob>,
  ) {}

  /**
   * Creates a new job in `pending` state with all four steps initialised.
   *
   * @param username - GitHub login of the user whose activity will be fetched.
   * @returns The saved job document (includes the `_id` used as the public jobId).
   */
  async create(username: string): Promise<ActivityJob & { _id: unknown }> {
    return this.jobModel.create({
      username,
      status: 'pending' satisfies JobStatus,
      steps: STEP_NAMES.map((name) => ({ name, status: 'pending' satisfies StepStatus, count: 0 })),
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      error: null,
    })
  }

  /**
   * Transitions the job to `running` and records when it started.
   *
   * @param jobId - The `_id` of the job document.
   */
  async markRunning(jobId: string): Promise<void> {
    await this.jobModel.findByIdAndUpdate(jobId, {
      status: 'running' satisfies JobStatus,
      startedAt: new Date().toISOString(),
    })
  }

  /**
   * Updates a single step's status and optionally its count.
   *
   * Uses the positional `$` operator so only the matching array element
   * is touched — no risk of clobbering other steps.
   *
   * @param jobId  - The `_id` of the job document.
   * @param name   - Which step to update.
   * @param status - New status for the step.
   * @param count  - Number of records upserted (set when `status` is `'done'`).
   */
  async updateStep(jobId: string, name: StepName, status: StepStatus, count?: number): Promise<void> {
    const set: Record<string, unknown> = { 'steps.$.status': status }
    if (count !== undefined) {
      set['steps.$.count'] = count
    }
    await this.jobModel.updateOne(
      { _id: jobId, 'steps.name': name },
      { $set: set },
    )
  }

  /**
   * Marks the job as successfully completed.
   *
   * @param jobId - The `_id` of the job document.
   */
  async markDone(jobId: string): Promise<void> {
    await this.jobModel.findByIdAndUpdate(jobId, {
      status: 'done' satisfies JobStatus,
      completedAt: new Date().toISOString(),
    })
  }

  /**
   * Marks the job as failed and records the error message.
   *
   * @param jobId - The `_id` of the job document.
   * @param error - Human-readable description of what went wrong.
   */
  async markFailed(jobId: string, error: string): Promise<void> {
    await this.jobModel.findByIdAndUpdate(jobId, {
      status: 'failed' satisfies JobStatus,
      completedAt: new Date().toISOString(),
      error,
    })
  }

  /**
   * Fetches a job by its ID.
   *
   * @param jobId - The `_id` of the job document (string form of ObjectId).
   * @returns The job document, or `null` if not found.
   */
  async findById(jobId: string): Promise<ActivityJob | null> {
    return this.jobModel.findById(jobId).lean()
  }
}
