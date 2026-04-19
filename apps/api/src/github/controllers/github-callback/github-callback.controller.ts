import 'reflect-metadata'
import { Controller, Get, Query, Inject } from '@nestjs/common'
import { Public } from '../../../auth/public.decorator.js'
import { GithubAppClientService } from '../../infrastructure/octokit/github-app-client.service.js'
import { HandleInstallCallbackService } from '../../services/handle-install-callback.service.js'
import { HandleOAuthCallbackService } from '../../services/handle-oauth-callback.service.js'
import { HandleCombinedCallbackService } from '../../services/handle-combined-callback.service.js'

interface CallbackQuery {
  code?: string
  state?: string
  installation_id?: string
  setup_action?: string
}

/**
 * Handles the single GitHub OAuth callback endpoint.
 * Dispatches to one of three handlers based on which query params arrive:
 *
 * 1. `installation_id` only — post-install with no OAuth (rare).
 * 2. `code` only — OAuth re-authorization without a new install.
 * 3. Both `code` and `installation_id` — the normal combined flow.
 *
 * `GET /auth/github`
 */
@Controller()
export class GithubCallbackController {
  constructor(
    @Inject(GithubAppClientService) private readonly githubAppClient: GithubAppClientService,
    @Inject(HandleInstallCallbackService)
    private readonly handleInstall: HandleInstallCallbackService,
    @Inject(HandleOAuthCallbackService)
    private readonly handleOAuth: HandleOAuthCallbackService,
    @Inject(HandleCombinedCallbackService)
    private readonly handleCombined: HandleCombinedCallbackService,
  ) {}

  @Public()
  @Get('auth/github')
  async callback(@Query() query: CallbackQuery): Promise<{ ok: boolean; message: string }> {
    this.githubAppClient.verifyCallbackState(query.state)

    const hasCode = !!query.code
    const hasInstallation = !!query.installation_id
    const installId = query.installation_id ? parseInt(query.installation_id, 10) : null

    if (hasCode && hasInstallation && installId !== null) {
      const { login } = await this.handleCombined.execute(query.code!, installId)
      return { ok: true, message: `Installation and authorization complete for ${login}` }
    }

    if (hasCode) {
      const { login } = await this.handleOAuth.execute(query.code!)
      return { ok: true, message: `Authorization complete for ${login}` }
    }

    if (hasInstallation && installId !== null) {
      await this.handleInstall.execute(installId)
      return { ok: true, message: `Installation ${installId} recorded` }
    }

    return { ok: false, message: 'No action taken (missing code and installation_id)' }
  }
}
