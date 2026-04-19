import { Injectable, Inject, BadRequestException } from '@nestjs/common'
import { GithubAppClientService } from '../infrastructure/octokit/github-app-client.service.js'

export interface PostCommentInput {
  installationId: number
  owner: string
  repo: string
  issueNumber: number
  body: string
  as: 'app' | 'user'
  userId?: number
}

/**
 * Posts a comment on a GitHub issue or PR, either as the installation bot
 * or as a real user using their stored OAuth token.
 */
@Injectable()
export class PostCommentService {
  constructor(
    @Inject(GithubAppClientService) private readonly githubAppClient: GithubAppClientService,
  ) {}

  async execute(input: PostCommentInput): Promise<{ commentId: number; url: string }> {
    if (input.as === 'user') {
      if (input.userId === undefined) {
        throw new BadRequestException('userId is required when as is "user"')
      }
      const octokit = await this.githubAppClient.getUserOctokit(input.userId)
      const { data } = await octokit.rest.issues.createComment({
        owner: input.owner,
        repo: input.repo,
        issue_number: input.issueNumber,
        body: input.body,
      })
      return { commentId: data.id, url: data.html_url }
    }

    // as: 'app' — use installation token
    const octokit = await this.githubAppClient.getInstallationOctokit(input.installationId)
    const { data } = await octokit.request(
      'POST /repos/{owner}/{repo}/issues/{issue_number}/comments',
      {
        owner: input.owner,
        repo: input.repo,
        issue_number: input.issueNumber,
        body: input.body,
      },
    )
    return { commentId: data.id as number, url: data.html_url as string }
  }
}
