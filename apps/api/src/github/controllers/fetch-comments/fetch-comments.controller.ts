import 'reflect-metadata'
import { Controller, Post, Param, Body, Headers, Inject } from '@nestjs/common'
import type { GithubComment, CommentType } from '@revi/octokit'
import { FetchUserCommentsService } from '../../services/fetch-user-comments.service.js'
import { FetchCommentsDto } from './fetch-comments.dto.js'

interface FetchCommentsResponse {
  username: string
  fetched: number
  breakdown: Record<CommentType, number>
  comments: GithubComment[]
}

@Controller('github')
export class FetchCommentsController {
  constructor(
    @Inject(FetchUserCommentsService) private readonly service: FetchUserCommentsService,
  ) {}

  /** `POST /github/:username/comments` */
  @Post(':username/comments')
  async fetchComments(
    @Param('username') username: string,
    @Body() dto: FetchCommentsDto,
    @Headers('authorization') authHeader?: string,
  ): Promise<FetchCommentsResponse> {
    const token = extractBearerToken(authHeader)
    const comments = await this.service.execute(username, dto.repos ?? [], token)

    const breakdown: Record<CommentType, number> = {
      pr_review_comment: 0,
      pr_comment: 0,
      commit_comment: 0,
    }
    for (const c of comments) {
      breakdown[c.type] = (breakdown[c.type] ?? 0) + 1
    }

    return { username, fetched: comments.length, breakdown, comments }
  }
}

function extractBearerToken(header: string | undefined): string | undefined {
  if (header === undefined || !header.startsWith('Bearer ')) return undefined
  return header.slice('Bearer '.length)
}
