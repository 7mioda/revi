import 'reflect-metadata'
import { Injectable, Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  createOctokitClient,
  fetchAllComments,
  getUserRepos,
} from '@revi/octokit'
import type { GithubComment, RepoRef } from '@revi/octokit'
import type { Env } from '../config.js'

/**
 * Thin NestJS wrapper around `@revi/octokit` functions.
 * Contains zero business logic — all fetching behaviour lives in the library.
 */
@Injectable()
export class GithubService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService<Env, true>) {}

  /**
   * Lists all repositories owned by a GitHub user.
   *
   * @param username - GitHub login of the user.
   * @param token - Optional per-request token override.
   */
  async getRepos(username: string, token?: string): Promise<RepoRef[]> {
    const client = createOctokitClient(token ?? this.config.get('GITHUB_TOKEN'))
    return getUserRepos(client, username)
  }

  /**
   * Fetches all PR-related comments for a GitHub user across the given repos.
   * If `repos` is empty, auto-discovers all repos owned by the user first.
   *
   * @param username - GitHub login whose comments to fetch.
   * @param repos - Subset of `owner/repo` strings to restrict the search.
   * @param token - Optional per-request token override.
   */
  async fetchComments(
    username: string,
    repos: string[],
    token?: string,
  ): Promise<GithubComment[]> {
    const client = createOctokitClient(token ?? this.config.get('GITHUB_TOKEN'))

    let repoRefs: RepoRef[]
    if (repos.length > 0) {
      repoRefs = repos.map((r) => {
        const [owner, name] = r.split('/')
        // Both parts are guaranteed by the DTO's @IsString regex; the non-null
        // assertion is safe — we rely on the validation layer, not runtime guards.
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
