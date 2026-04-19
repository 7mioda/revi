import { Injectable, Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Octokit } from '@octokit/rest'
import type { Env } from '../../config.js'
import { encryptToken } from '../lib/crypto.js'
import { GithubAppClientService } from '../infrastructure/octokit/github-app-client.service.js'
import { GithubUserRepository } from '../infrastructure/persistence/github-user.repository.js'

/**
 * Handles the OAuth-only callback (no installation_id).
 * Exchanges the code, fetches the authenticated user, persists encrypted tokens.
 */
@Injectable()
export class HandleOAuthCallbackService {
  constructor(
    @Inject(GithubAppClientService) private readonly githubAppClient: GithubAppClientService,
    @Inject(GithubUserRepository) private readonly userRepo: GithubUserRepository,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  async execute(code: string): Promise<{ userId: number; login: string }> {
    const tokens = await this.githubAppClient.exchangeCode(code)
    const userOctokit = new Octokit({ auth: tokens.accessToken })
    const { data: user } = await userOctokit.rest.users.getAuthenticated()
    const encKey = this.config.get('TOKEN_ENCRYPTION_KEY')
    await this.userRepo.upsert(
      user.id,
      user.login,
      encryptToken(tokens.accessToken, encKey),
      tokens.refreshToken ? encryptToken(tokens.refreshToken, encKey) : null,
      tokens.expiresAt,
      tokens.refreshTokenExpiresAt,
    )
    return { userId: user.id, login: user.login }
  }
}
