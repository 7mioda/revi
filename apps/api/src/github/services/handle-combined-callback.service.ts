import { Injectable, Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Octokit } from '@octokit/rest'
import type { Env } from '../../config.js'
import { encryptToken } from '../lib/crypto.js'
import { GithubAppClientService } from '../infrastructure/octokit/github-app-client.service.js'
import { GithubUserRepository } from '../infrastructure/persistence/github-user.repository.js'
import { HandleInstallCallbackService } from './handle-install-callback.service.js'

/**
 * Handles the combined install + OAuth callback — the normal flow when
 * "Request user authorization during installation" is enabled.
 * Persists both the installation and the user token in parallel.
 */
@Injectable()
export class HandleCombinedCallbackService {
  constructor(
    @Inject(GithubAppClientService) private readonly githubAppClient: GithubAppClientService,
    @Inject(HandleInstallCallbackService)
    private readonly handleInstall: HandleInstallCallbackService,
    @Inject(GithubUserRepository) private readonly userRepo: GithubUserRepository,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  async execute(
    code: string,
    installationId: number,
  ): Promise<{ userId: number; login: string }> {
    const tokens = await this.githubAppClient.exchangeCode(code)
    const userOctokit = new Octokit({ auth: tokens.accessToken })
    const { data: user } = await userOctokit.rest.users.getAuthenticated()
    const encKey = this.config.get('TOKEN_ENCRYPTION_KEY')

    await Promise.all([
      this.handleInstall.execute(installationId),
      this.userRepo.upsert(
        user.id,
        user.login,
        encryptToken(tokens.accessToken, encKey),
        tokens.refreshToken ? encryptToken(tokens.refreshToken, encKey) : null,
        tokens.expiresAt,
        tokens.refreshTokenExpiresAt,
        installationId,
      ),
    ])

    return { userId: user.id, login: user.login }
  }
}
