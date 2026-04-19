import 'reflect-metadata'
import { Controller, Get, HttpStatus, Inject, Redirect } from '@nestjs/common'
import { Public } from '../../../auth/public.decorator.js'
import { GithubAppClientService } from '../../infrastructure/octokit/github-app-client.service.js'

@Controller()
export class InstallController {
  constructor(
    @Inject(GithubAppClientService) private readonly githubAppClient: GithubAppClientService,
  ) {}

  /**
   * Redirects the browser to the GitHub App installation page with a signed
   * CSRF state token embedded.
   *
   * `GET /auth/github/install`
   */
  @Public()
  @Get('auth/github/install')
  @Redirect('', HttpStatus.FOUND)
  install(): { url: string } {
    return { url: this.githubAppClient.getInstallUrl() }
  }
}
