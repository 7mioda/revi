import 'reflect-metadata'
import { Controller, Post, Get, Param, Inject, Headers, HttpCode, NotFoundException } from '@nestjs/common'
import { UsersService } from './users.service.js'
import { JobsService } from './jobs.service.js'
import type { ActivityJob } from './job.schema.js'

/**
 * Exposes public-user activity fetching (issues, pull requests, comments).
 * An optional `Authorization: Bearer <token>` header enables private-repo access.
 */
@Controller('users')
export class UsersController {
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(JobsService) private readonly jobsService: JobsService,
  ) {}

  /**
   * Enqueues an activity fetch job for a GitHub username and returns immediately.
   *
   * `POST /users/:username/activity`
   *
   * @param username      - GitHub login of the target user (path param).
   * @param authorization - Optional `Authorization: Bearer <token>` header.
   * @returns `{ jobId }` — poll `GET /users/jobs/:jobId` to follow progress.
   */
  @Post(':username/activity')
  @HttpCode(202)
  async fetchActivity(
    @Param('username') username: string,
    @Headers('authorization') authorization: string | undefined,
  ): Promise<{ jobId: string }> {
    const token = extractBearerToken(authorization)
    const job = await this.jobsService.create(username)
    const jobId = String(job._id)
    void this.usersService.run(jobId, username, token)
    return { jobId }
  }

  /**
   * Returns the current state of an activity fetch job.
   *
   * `GET /users/jobs/:jobId`
   *
   * @param jobId - The ID returned by `POST /users/:username/activity`.
   * @returns The job document, or 404 if not found.
   */
  @Get('jobs/:jobId')
  async getJob(@Param('jobId') jobId: string): Promise<ActivityJob> {
    const job = await this.jobsService.findById(jobId)
    if (!job) throw new NotFoundException(`Job ${jobId} not found`)
    return job
  }
}

/**
 * Extracts the token from an `Authorization: Bearer <token>` header value.
 * Returns `undefined` for absent or non-Bearer schemes.
 */
function extractBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization) return undefined
  const [scheme, token] = authorization.split(' ')
  if (scheme !== 'Bearer' || !token) return undefined
  return token
}
