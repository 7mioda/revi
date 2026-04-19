import 'reflect-metadata'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetReposController } from '../github/controllers/get-repos/get-repos.controller.js'
import { FetchCommentsController } from '../github/controllers/fetch-comments/fetch-comments.controller.js'
import type { FetchUserReposService } from '../github/services/fetch-user-repos.service.js'
import type { FetchUserCommentsService } from '../github/services/fetch-user-comments.service.js'
import type { RepoRef } from '@revi/octokit'

function makeGetReposController(overrides: Partial<FetchUserReposService> = {}): GetReposController {
  const service = {
    execute: vi.fn<(u: string, t?: string) => Promise<RepoRef[]>>().mockResolvedValue([]),
    ...overrides,
  } as unknown as FetchUserReposService
  return new GetReposController(service)
}

function makeFetchCommentsController(
  overrides: Partial<FetchUserCommentsService> = {},
): FetchCommentsController {
  const service = {
    execute: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as FetchUserCommentsService
  return new FetchCommentsController(service)
}

describe('GetReposController', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('GET /github/:username/repos', () => {
    it('returns username and repos array from service', async () => {
      const controller = makeGetReposController({
        execute: vi.fn().mockResolvedValue([{ owner: 'alice', name: 'repo-a' }]),
      })

      const result = await controller.getRepos('alice')

      expect(result).toEqual({
        username: 'alice',
        repos: [{ owner: 'alice', name: 'repo-a' }],
      })
    })

    it('delegates to FetchUserReposService.execute with the username', async () => {
      const execute = vi.fn<(u: string, t?: string) => Promise<RepoRef[]>>().mockResolvedValue([])
      const controller = makeGetReposController({ execute })

      await controller.getRepos('bob')

      expect(execute).toHaveBeenCalledWith('bob', undefined)
    })

    it('passes bearer token from Authorization header to service', async () => {
      const execute = vi.fn<(u: string, t?: string) => Promise<RepoRef[]>>().mockResolvedValue([])
      const controller = makeGetReposController({ execute })

      await controller.getRepos('bob', 'Bearer mytoken')

      expect(execute).toHaveBeenCalledWith('bob', 'mytoken')
    })
  })
})

describe('FetchCommentsController', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('POST /github/:username/comments', () => {
    it('returns breakdown and total count', async () => {
      const controller = makeFetchCommentsController({
        execute: vi.fn().mockResolvedValue([
          { type: 'pr_review_comment' },
          { type: 'pr_review_comment' },
          { type: 'pr_comment' },
        ]),
      })

      const result = await controller.fetchComments('alice', {})

      expect(result.fetched).toBe(3)
      expect(result.breakdown).toMatchObject({
        pr_review_comment: 2,
        pr_comment: 1,
        commit_comment: 0,
      })
    })

    it('passes repos from body to service', async () => {
      const execute = vi.fn().mockResolvedValue([])
      const controller = makeFetchCommentsController({ execute })

      await controller.fetchComments('alice', { repos: ['alice/repo'] })

      expect(execute).toHaveBeenCalledWith('alice', ['alice/repo'], undefined)
    })
  })
})
