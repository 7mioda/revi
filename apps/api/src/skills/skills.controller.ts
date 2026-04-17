import 'reflect-metadata'
import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common'
import { SkillsService } from './skills.service.js'
import { GenerateSkillsDto } from './dto/generate-skills.dto.js'
import type { GenerateSkillsResult } from './skills.service.js'

@Controller('skills')
export class SkillsController {
  constructor(@Inject(SkillsService) private readonly skillsService: SkillsService) {}

  @Post()
  @HttpCode(201)
  async generate(@Body() dto: GenerateSkillsDto): Promise<GenerateSkillsResult> {
    return this.skillsService.generate(dto.sampleSize ?? 2000, dto.userId, dto.username)
  }
}
