import 'reflect-metadata'
import { Controller, Get, Param, Inject, NotFoundException } from '@nestjs/common'
import { Public } from '../../../auth/public.decorator.js'
import {
  ProfileRepository,
  SkillRepository,
} from '../../infrastructure/persistence/index.js'

@Controller('profile')
export class ListProfileSkillsController {
  constructor(
    @Inject(ProfileRepository) private readonly profileRepo: ProfileRepository,
    @Inject(SkillRepository) private readonly skillRepo: SkillRepository,
  ) {}

  /** List all skills for a profile. */
  @Public()
  @Get(':profileId/skills')
  async list(@Param('profileId') profileId: string) {
    const profile = await this.profileRepo.findById(profileId)
    if (!profile) throw new NotFoundException(`Profile ${profileId} not found`)
    return this.skillRepo.findByUsername(profile.username)
  }
}
