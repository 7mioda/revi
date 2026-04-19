import { Injectable, Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createOctokitClient, fetchAllComments, getUserRepos } from '@revi/octokit'
import type { GithubComment, RepoRef } from '@revi/octokit'
import type { Env } from '../../config.js'

/**
 * Fetches all PR-related comments for a GitHub user across the given repos.
 * If `repos` is empty, auto-discovers all repos owned by the user first.
 */
@Injectable()
export class FetchUserCommentsService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService<Env, true>) {}

  async execute(username: string, repos: string[], token?: string): Promise<GithubComment[]> {
    const client = createOctokitClient(token ?? this.config.get('GITHUB_TOKEN'))

    let repoRefs: RepoRef[]
    if (repos.length > 0) {
      repoRefs = repos.map((r) => {
        const [owner, name] = r.split('/')
        return { owner: owner ?? username, name: name ?? r }
      })
    } else {
      repoRefs = await getUserRepos(client, username)
    }

    const nested = await Promise.all(
      repoRefs.map((ref) => fetchAllComments(client, ref.owner, ref.name)),
    )
    return nested.flat()
  }
}
