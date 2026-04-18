import 'reflect-metadata'
import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  NotFoundException,
  HttpCode,
} from '@nestjs/common'
import { ProfilesService } from './profiles.service.js'
import { SyncProfileDto } from './dto/sync-profile.dto.js'
import { Public } from '../auth/public.decorator.js'

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  /** Start a new profile sync job for `username`. Returns 202 `{ jobId }`. */
  @Post(':username/sync')
  @HttpCode(202)
  async sync(
    @Param('username') username: string,
    @Body() body: SyncProfileDto,
  ): Promise<{ jobId: string }> {
    const jobId = await this.profilesService.sync(username, body.token)
    return { jobId }
  }

  /** Retry a failed/partial sync job — skips steps that already succeeded. */
  @Post(':username/sync/:jobId/retry')
  @HttpCode(202)
  async retry(
    @Param('username') username: string,
    @Param('jobId') jobId: string,
    @Body() body: SyncProfileDto,
  ): Promise<{ jobId: string }> {
    const id = await this.profilesService.sync(username, body.token, jobId)
    return { jobId: id }
  }

  /** List all public profiles, sorted by follower count descending. */
  @Public()
  @Get()
  async listProfiles() {
    return this.profilesService.listProfiles()
  }

  /** Fetch a sync job by ID. */
  @Public()
  @Get('jobs/:jobId')
  async getJob(@Param('jobId') jobId: string) {
    const job = await this.profilesService.findJob(jobId)
    if (!job) throw new NotFoundException(`Job ${jobId} not found`)
    return job
  }

  /** Fetch skills + preferences + profile for a persona chat session. */
  @Public()
  @Get(':username/context')
  async getPersonaContext(@Param('username') username: string) {
    const ctx = await this.profilesService.getPersonaContext(username)
    if (!ctx) throw new NotFoundException(`Profile for ${username} not found`)
    return ctx
  }

  /** Fetch the GitHub profile for `username`. */
  @Get(':username')
  async getProfile(@Param('username') username: string) {
    const profile = await this.profilesService.findProfile(username)
    if (!profile) throw new NotFoundException(`Profile for ${username} not found`)
    return profile
  }
}
