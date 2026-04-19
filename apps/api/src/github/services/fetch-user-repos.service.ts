import { Injectable, Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createOctokitClient, getUserRepos } from '@revi/octokit'
import type { RepoRef } from '@revi/octokit'
import type { Env } from '../../config.js'

/**
 * Lists all repositories owned by a GitHub user.
 */
@Injectable()
export class FetchUserReposService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService<Env, true>) {}

  async execute(username: string, token?: string): Promise<RepoRef[]> {
    const client = createOctokitClient(token ?? this.config.get('GITHUB_TOKEN'))
    return getUserRepos(client, username)
  }
}
