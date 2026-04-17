import 'reflect-metadata'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UsersController } from '../users/users.controller.js'
import type { UsersService } from '../users/users.service.js'
import type { JobsService } from '../users/jobs.service.js'

function makeUsersService(): Partial<UsersService> {
  return { run: vi.fn().mockResolvedValue(undefined) }
}

function makeJobsService(jobId = 'job-123'): Partial<JobsService> {
  return {
    create: vi.fn().mockResolvedValue({ _id: jobId }),
    findById: vi.fn().mockResolvedValue(null),
  }
}

function makeController(
  usersService: Partial<UsersService> = makeUsersService(),
  jobsService: Partial<JobsService> = makeJobsService(),
): UsersController {
  return new UsersController(usersService as UsersService, jobsService as JobsService)
}

describe('UsersController POST /users/:username/activity', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 202 with a jobId', async () => {
    const controller = makeController(makeUsersService(), makeJobsService('abc-1'))

    const result = await controller.fetchActivity('alice', undefined)

    expect(result).toEqual({ jobId: 'abc-1' })
  })

  it('passes username and no token when Authorization header is absent', async () => {
    const usersService = makeUsersService()
    const jobsService = makeJobsService('job-1')
    const controller = makeController(usersService, jobsService)

    await controller.fetchActivity('octocat', undefined)

    expect(usersService.run).toHaveBeenCalledWith('job-1', 'octocat', undefined)
  })

  it('extracts Bearer token from Authorization header', async () => {
    const usersService = makeUsersService()
    const jobsService = makeJobsService('job-2')
    const controller = makeController(usersService, jobsService)

    await controller.fetchActivity('alice', 'Bearer ghp_abc123')

    expect(usersService.run).toHaveBeenCalledWith('job-2', 'alice', 'ghp_abc123')
  })

  it('passes undefined token when Authorization header has unexpected format', async () => {
    const usersService = makeUsersService()
    const jobsService = makeJobsService('job-3')
    const controller = makeController(usersService, jobsService)

    await controller.fetchActivity('alice', 'Basic somebase64')

    expect(usersService.run).toHaveBeenCalledWith('job-3', 'alice', undefined)
  })

  it('fires the job in the background without awaiting it', async () => {
    let resolveRun!: () => void
    const runPromise = new Promise<void>((res) => { resolveRun = res })
    const usersService = { run: vi.fn().mockReturnValue(runPromise) }
    const jobsService = makeJobsService('job-bg')
    const controller = makeController(usersService, jobsService)

    // fetchActivity resolves immediately even though run is still pending
    await expect(controller.fetchActivity('alice', undefined)).resolves.toEqual({ jobId: 'job-bg' })
    resolveRun()
  })
})

describe('UsersController GET /users/jobs/:jobId', () => {
  it('returns the job document when found', async () => {
    const job = { _id: 'j1', username: 'alice', status: 'running', steps: [] }
    const jobsService = { ...makeJobsService(), findById: vi.fn().mockResolvedValue(job) }
    const controller = makeController(makeUsersService(), jobsService)

    const result = await controller.getJob('j1')

    expect(result).toBe(job)
  })

  it('throws NotFoundException when the job does not exist', async () => {
    const controller = makeController()

    await expect(controller.getJob('nonexistent')).rejects.toThrow('not found')
  })
})
