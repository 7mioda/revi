import 'reflect-metadata'
import {
  Controller,
  Get,
  Param,
  Query,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common'
import { Public } from '../../../auth/public.decorator.js'
import {
  ProfileRepository,
  ProfileJobRepository,
  SkillRepository,
  PreferenceRepository,
} from '../../infrastructure/persistence/index.js'

@Controller('profile')
export class GetProfileController {
  constructor(
    @Inject(ProfileRepository) private readonly profileRepo: ProfileRepository,
    @Inject(ProfileJobRepository) private readonly jobRepo: ProfileJobRepository,
    @Inject(SkillRepository) private readonly skillRepo: SkillRepository,
    @Inject(PreferenceRepository) private readonly preferenceRepo: PreferenceRepository,
  ) {}

  /** List all profiles sorted by follower count descending. */
  @Public()
  @Get()
  async list() {
    return this.profileRepo.list()
  }

  /** Fetch a sync job by ID. */
  @Public()
  @Get('jobs/:jobId')
  async getJob(@Param('jobId') jobId: string) {
    const job = await this.jobRepo.findById(jobId)
    if (!job) throw new NotFoundException(`Job ${jobId} not found`)
    return job
  }

  /** Fetch a profile by MongoDB ID. */
  @Get(':profileId')
  async get(@Param('profileId') profileId: string) {
    const profile = await this.profileRepo.findById(profileId)
    if (!profile) throw new NotFoundException(`Profile ${profileId} not found`)
    return profile
  }

  /** Activity summary since a given ISO timestamp. */
  @Public()
  @Get(':profileId/activity-summary')
  async getActivitySummary(
    @Param('profileId') profileId: string,
    @Query('since') since: string,
  ) {
    if (!since) throw new BadRequestException('since query param is required')
    const profile = await this.profileRepo.findById(profileId)
    if (!profile) throw new NotFoundException(`Profile ${profileId} not found`)

    const [profileSyncs, skillsGenerated, preferencesGenerated] = await Promise.all([
      this.jobRepo.findCompletedAfter(profile.username, since),
      this.skillRepo.countGeneratedAfter(profile.username, since),
      this.preferenceRepo.countGeneratedAfter(profile.username, since),
    ])

    return {
      profileSyncs: profileSyncs.map((j) => ({
        completedAt: j.completedAt,
        steps: j.steps.map((s) => ({ name: s.name, count: s.count })),
      })),
      skillsGenerated,
      preferencesGenerated,
      reviewsTotal: profile.reviews,
    }
  }

  /** Fetch skills + preferences + profile for a persona chat session. */
  @Public()
  @Get(':profileId/context')
  async getPersonaContext(@Param('profileId') profileId: string) {
    const profile = await this.profileRepo.findById(profileId)
    if (!profile) throw new NotFoundException(`Profile ${profileId} not found`)

    const [skills, preferences] = await Promise.all([
      this.skillRepo.findByUsername(profile.username),
      this.preferenceRepo.findByUsername(profile.username),
    ])

    return { profile, skills, preferences }
  }
}
