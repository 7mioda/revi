import 'reflect-metadata'
import { Controller, Get, Param, Inject, NotFoundException } from '@nestjs/common'
import { Public } from '../../../auth/public.decorator.js'
import { SkillRepository } from '../../infrastructure/persistence/index.js'

@Controller('profile/skills')
export class GetSkillController {
  constructor(
    @Inject(SkillRepository) private readonly skillRepo: SkillRepository,
  ) {}

  /** Fetch a skill by MongoDB ID. */
  @Public()
  @Get(':skillId')
  async get(@Param('skillId') skillId: string) {
    const skill = await this.skillRepo.findById(skillId)
    if (!skill) throw new NotFoundException(`Skill ${skillId} not found`)
    return skill
  }
}
