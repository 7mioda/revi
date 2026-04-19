import 'reflect-metadata'
import { Controller, Get, Param, Headers, Inject } from '@nestjs/common'
import type { RepoRef } from '@revi/octokit'
import { FetchUserReposService } from '../../services/fetch-user-repos.service.js'

interface GetReposResponse {
  username: string
  repos: RepoRef[]
}

@Controller('github')
export class GetReposController {
  constructor(@Inject(FetchUserReposService) private readonly service: FetchUserReposService) {}

  /** `GET /github/:username/repos` */
  @Get(':username/repos')
  async getRepos(
    @Param('username') username: string,
    @Headers('authorization') authHeader?: string,
  ): Promise<GetReposResponse> {
    const token = extractBearerToken(authHeader)
    const repos = await this.service.execute(username, token)
    return { username, repos }
  }
}

function extractBearerToken(header: string | undefined): string | undefined {
  if (header === undefined || !header.startsWith('Bearer ')) return undefined
  return header.slice('Bearer '.length)
}
