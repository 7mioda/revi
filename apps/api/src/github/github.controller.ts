import 'reflect-metadata'
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Headers,
} from '@nestjs/common'
import { GithubService } from './github.service.js'
import type { RepoRef, GithubComment, CommentType } from '@revi/octokit'
import { FetchCommentsDto } from './dto/fetch-comments.dto.js'

interface GetReposResponse {
  username: string
  repos: RepoRef[]
}

interface FetchCommentsResponse {
  username: string
  fetched: number
  breakdown: Record<CommentType, number>
  comments: GithubComment[]
}

/**
 * Exposes GitHub fetching functionality over HTTP.
 * All routes delegate to `GithubService` — no business logic lives here.
 */
@Controller('github')
export class GithubController {
  constructor(private readonly github: GithubService) {}

  /**
   * Lists all repositories owned by the given GitHub user.
   * `GET /github/:username/repos`
   */
  @Get(':username/repos')
  async getRepos(
    @Param('username') username: string,
    @Headers('authorization') authHeader?: string,
  ): Promise<GetReposResponse> {
    const token = extractBearerToken(authHeader)
    const repos = await this.github.getRepos(username, token)
    return { username, repos }
  }

  /**
   * Fetches all PR-related comments for a GitHub user.
   * `POST /github/:username/comments`
   */
  @Post(':username/comments')
  async fetchComments(
    @Param('username') username: string,
    @Body() dto: FetchCommentsDto,
    @Headers('authorization') authHeader?: string,
  ): Promise<FetchCommentsResponse> {
    const token = extractBearerToken(authHeader)
    const comments = await this.github.fetchComments(
      username,
      dto.repos ?? [],
      token,
    )

    const breakdown: Record<CommentType, number> = {
      pr_review_comment: 0,
      pr_comment: 0,
      commit_comment: 0,
    }
    for (const c of comments) {
      // breakdown is initialised with all CommentType keys above; ?? 0 satisfies
      // noUncheckedIndexedAccess without changing the runtime behaviour.
      breakdown[c.type] = (breakdown[c.type] ?? 0) + 1
    }

    return { username, fetched: comments.length, breakdown, comments }
  }
}

/** Extracts the token from an `Authorization: Bearer <token>` header. */
function extractBearerToken(header: string | undefined): string | undefined {
  if (header === undefined || !header.startsWith('Bearer ')) return undefined
  return header.slice('Bearer '.length)
}
