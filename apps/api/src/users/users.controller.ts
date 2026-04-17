import 'reflect-metadata'
import { Controller, Post, Body, Inject } from '@nestjs/common'
import { UsersService } from './users.service.js'
import { FetchUserCommentsDto } from './dto/fetch-user-comments.dto.js'
import type { FetchUserCommentsResult } from './users.service.js'

/**
 * Exposes public-user comment fetching.
 * Uses the server's own GitHub token — no user token required.
 */
@Controller('users')
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  /**
   * Fetches all public comments made by a GitHub username and persists them.
   *
   * `POST /users/comments`
   *
   * @param dto - Request body containing the target GitHub username.
   * @returns Summary with user login, number of records saved, and type breakdown.
   */
  @Post('comments')
  async fetchAndSave(@Body() dto: FetchUserCommentsDto): Promise<FetchUserCommentsResult> {
    return this.usersService.fetchAndSave(dto.username)
  }
}
