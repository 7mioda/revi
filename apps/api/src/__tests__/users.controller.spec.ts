import 'reflect-metadata'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UsersController } from '../users/users.controller.js'
import type { UsersService, UserActivityResult } from '../users/users.service.js'

const EMPTY_RESULT: UserActivityResult = { user: 'alice', issues: 0, pullRequests: 0, comments: 0 }

function makeController(overrides: Partial<UsersService> = {}): UsersController {
  const service = {
    fetchAndSave: vi.fn().mockResolvedValue(EMPTY_RESULT),
    ...overrides,
  } as unknown as UsersService
  return new UsersController(service)
}

describe('UsersController POST /users/:username/activity', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns activity result with user, issues, pullRequests, comments', async () => {
    const controller = makeController({
      fetchAndSave: vi.fn().mockResolvedValue({ user: 'alice', issues: 5, pullRequests: 3, comments: 42 }),
    })

    const result = await controller.fetchActivity('alice', undefined)

    expect(result).toMatchObject({ user: 'alice', issues: 5, pullRequests: 3, comments: 42 })
  })

  it('passes username and no token when Authorization header is absent', async () => {
    const fetchAndSave = vi.fn().mockResolvedValue(EMPTY_RESULT)
    const controller = makeController({ fetchAndSave })

    await controller.fetchActivity('octocat', undefined)

    expect(fetchAndSave).toHaveBeenCalledWith('octocat', undefined)
  })

  it('extracts Bearer token from Authorization header', async () => {
    const fetchAndSave = vi.fn().mockResolvedValue(EMPTY_RESULT)
    const controller = makeController({ fetchAndSave })

    await controller.fetchActivity('alice', 'Bearer ghp_abc123')

    expect(fetchAndSave).toHaveBeenCalledWith('alice', 'ghp_abc123')
  })

  it('passes undefined token when Authorization header has unexpected format', async () => {
    const fetchAndSave = vi.fn().mockResolvedValue(EMPTY_RESULT)
    const controller = makeController({ fetchAndSave })

    await controller.fetchActivity('alice', 'Basic somebase64')

    expect(fetchAndSave).toHaveBeenCalledWith('alice', undefined)
  })
})
