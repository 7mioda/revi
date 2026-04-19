import { Injectable, Inject } from '@nestjs/common'
import { GithubAppClientService } from '../infrastructure/octokit/github-app-client.service.js'
import { InstallationRepository } from '../infrastructure/persistence/installation.repository.js'

/**
 * Handles the post-install-only callback (no OAuth code).
 * Fetches installation details from GitHub and persists them.
 */
@Injectable()
export class HandleInstallCallbackService {
  constructor(
    @Inject(GithubAppClientService) private readonly githubAppClient: GithubAppClientService,
    @Inject(InstallationRepository) private readonly installationRepo: InstallationRepository,
  ) {}

  async execute(installationId: number): Promise<void> {
    const { data } = await this.githubAppClient.app.octokit.request(
      'GET /app/installations/{installation_id}',
      { installation_id: installationId },
    )
    const account = data.account
    // account is a User | Enterprise union — only User has `login` and `type`
    const accountLogin = account && 'login' in account ? account.login : 'unknown'
    const accountType = account && 'type' in account ? account.type : 'Organization'
    await this.installationRepo.upsert(
      installationId,
      accountLogin,
      accountType,
      data as unknown as Record<string, unknown>,
    )
  }
}
