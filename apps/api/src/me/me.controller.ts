import 'reflect-metadata'
import { Controller, Post, Body, Inject } from '@nestjs/common'
import { MeService } from './me.service.js'
import { FetchMyCommentsDto } from './dto/fetch-my-comments.dto.js'
import type { FetchAndSaveResult } from './me.service.js'

/**
 * Exposes token-authenticated "me" operations.
 * All routes delegate to `MeService` — no business logic lives here.
 */
@Controller('me')
export class MeController {
  constructor(@Inject(MeService) private readonly me: MeService) {}

  /**
   * Fetches all comments made by the token owner across every accessible
   * repository and persists them to MongoDB.
   *
   * `POST /me/comments`
   *
   * @param dto - Request body containing the GitHub personal access token.
   * @returns Summary with user login, number of records saved, and type breakdown.
   */
  @Post('comments')
  async fetchAndSave(@Body() dto: FetchMyCommentsDto): Promise<FetchAndSaveResult> {
    return this.me.fetchAndSave(dto.token)
  }
}
