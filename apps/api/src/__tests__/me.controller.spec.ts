import 'reflect-metadata'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MeController } from '../me/me.controller.js'
import type { MeService } from '../me/me.service.js'

function makeController(overrides: Partial<MeService> = {}): MeController {
  const service = {
    fetchAndSave: vi.fn().mockResolvedValue({
      user: 'alice',
      saved: 3,
      breakdown: { pr_review_comment: 2, pr_comment: 1, commit_comment: 0 },
    }),
    ...overrides,
  } as unknown as MeService
  return new MeController(service)
}

describe('MeController POST /me/comments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns user, saved count, and breakdown', async () => {
    const controller = makeController()

    const result = await controller.fetchAndSave({ token: 'ghp_test' })

    expect(result).toMatchObject({
      user: 'alice',
      saved: 3,
      breakdown: { pr_review_comment: 2, pr_comment: 1, commit_comment: 0 },
    })
  })

  it('delegates the token to MeService.fetchAndSave', async () => {
    const fetchAndSave = vi.fn().mockResolvedValue({ user: 'x', saved: 0, breakdown: {} })
    const controller = makeController({ fetchAndSave })

    await controller.fetchAndSave({ token: 'ghp_mytoken' })

    expect(fetchAndSave).toHaveBeenCalledWith('ghp_mytoken')
  })
})
