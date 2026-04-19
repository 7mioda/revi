import { Injectable, Inject } from '@nestjs/common'
import { GithubAppClientService } from '../infrastructure/octokit/github-app-client.service.js'

/**
 * Fetches the GitHub notifications feed for a linked user.
 */
@Injectable()
export class GetUserNotificationsService {
  constructor(
    @Inject(GithubAppClientService) private readonly githubAppClient: GithubAppClientService,
  ) {}

  async execute(githubUserId: number): Promise<unknown[]> {
    const octokit = await this.githubAppClient.getUserOctokit(githubUserId)
    const { data } = await octokit.rest.activity.listNotificationsForAuthenticatedUser({
      all: false,
    })
    return data
  }
}
