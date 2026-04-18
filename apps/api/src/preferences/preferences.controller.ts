import 'reflect-metadata'
import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common'
import { PreferencesService } from './preferences.service.js'
import { GeneratePreferencesDto } from './dto/generate-preferences.dto.js'
import type { GeneratePreferencesResult } from './preferences.service.js'

@Controller('preferences')
export class PreferencesController {
  constructor(@Inject(PreferencesService) private readonly preferencesService: PreferencesService) {}

  @Post()
  @HttpCode(201)
  async generate(@Body() dto: GeneratePreferencesDto): Promise<GeneratePreferencesResult> {
    return this.preferencesService.generate(dto.userId, dto.username)
  }
}
