import 'reflect-metadata'
import { Controller, Post, Param, Body, Inject, HttpCode } from '@nestjs/common'
import { CreateProfileService } from '../../services/create-profile/index.js'
import { CreateProfileInput, RetryProfileInput } from './create-profile.input.js'
import type { CreateProfileOutput } from './create-profile.output.js'

@Controller('profile')
export class CreateProfileController {
  constructor(
    @Inject(CreateProfileService) private readonly service: CreateProfileService,
  ) {}

  /** Start a new profile sync job. Returns 202 `{ jobId }` immediately. */
  @Post()
  @HttpCode(202)
  async create(@Body() body: CreateProfileInput): Promise<CreateProfileOutput> {
    return this.service.execute({ username: body.username, token: body.token })
  }

  /** Retry a failed/partial sync job — skips steps that already succeeded. */
  @Post(':profileId/retry')
  @HttpCode(202)
  async retry(
    @Param('profileId') profileId: string,
    @Body() body: RetryProfileInput,
  ): Promise<CreateProfileOutput> {
    return this.service.execute({ profileId, existingJobId: body.jobId, token: body.token })
  }
}
