import 'reflect-metadata'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GithubController } from '../github/github.controller.js'
import type { GithubService } from '../github/github.service.js'
import type { RepoRef } from '@revi/octokit'

// Direct instantiation avoids NestJS DI metadata requirements in vitest
// (esbuild doesn't emit emitDecoratorMetadata; DI wiring is tested at e2e level)
function makeController(overrides: Partial<GithubService> = {}): GithubController {
  const service = {
    getRepos: vi.fn<(u: string, t?: string) => Promise<RepoRef[]>>().mockResolvedValue([]),
    fetchComments: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as GithubService
  return new GithubController(service)
}

describe('GithubController', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('GET /github/:username/repos', () => {
    it('returns username and repos array from service', async () => {
      const controller = makeController({
        getRepos: vi.fn().mockResolvedValue([{ owner: 'alice', name: 'repo-a' }]),
      })

      const result = await controller.getRepos('alice')

      expect(result).toEqual({
        username: 'alice',
        repos: [{ owner: 'alice', name: 'repo-a' }],
      })
    })

    it('delegates to GithubService.getRepos with the username', async () => {
      const getRepos = vi.fn<(u: string, t?: string) => Promise<RepoRef[]>>().mockResolvedValue([])
      const controller = makeController({ getRepos })

      await controller.getRepos('bob')

      expect(getRepos).toHaveBeenCalledWith('bob', undefined)
    })

    it('passes bearer token from Authorization header to service', async () => {
      const getRepos = vi.fn<(u: string, t?: string) => Promise<RepoRef[]>>().mockResolvedValue([])
      const controller = makeController({ getRepos })

      await controller.getRepos('bob', 'Bearer mytoken')

      expect(getRepos).toHaveBeenCalledWith('bob', 'mytoken')
    })
  })

  describe('POST /github/:username/comments', () => {
    it('returns breakdown and total count', async () => {
      const controller = makeController({
        fetchComments: vi.fn().mockResolvedValue([
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
      const fetchComments = vi.fn().mockResolvedValue([])
      const controller = makeController({ fetchComments })

      await controller.fetchComments('alice', { repos: ['alice/repo'] })

      expect(fetchComments).toHaveBeenCalledWith('alice', ['alice/repo'], undefined)
    })
  })
})
