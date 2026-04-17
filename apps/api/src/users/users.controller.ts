import 'reflect-metadata'
import { Controller, Post, Param, Inject, Headers } from '@nestjs/common'
import { UsersService } from './users.service.js'
import type { UserActivityResult } from './users.service.js'

/**
 * Exposes public-user activity fetching (issues, pull requests, comments).
 * An optional `Authorization: Bearer <token>` header enables private-repo access.
 */
@Controller('users')
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  /**
   * Fetches issues, pull requests, and comments for a GitHub username and
   * persists them in sequential steps.
   *
   * `POST /users/:username/activity`
   *
   * @param username      - GitHub login of the target user (path param).
   * @param authorization - Optional `Authorization: Bearer <token>` header.
   * @returns Counts of each resource type upserted.
   */
  @Post(':username/activity')
  async fetchActivity(
    @Param('username') username: string,
    @Headers('authorization') authorization: string | undefined,
  ): Promise<UserActivityResult> {
    const token = extractBearerToken(authorization)
    return this.usersService.fetchAndSave(username, token)
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
