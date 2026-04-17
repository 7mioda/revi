import 'reflect-metadata'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { JobsService } from '../users/jobs.service.js'
import { STEP_NAMES } from '../users/job.schema.js'
import type { Types } from 'mongoose'

// ---------------------------------------------------------------------------
// Minimal mock for the ActivityJob Mongoose model
// ---------------------------------------------------------------------------
function makeDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'job-id-123' as unknown as Types.ObjectId,
    username: 'alice',
    status: 'pending',
    steps: STEP_NAMES.map((n) => ({ name: n, status: 'pending', count: 0 })),
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    error: null,
    ...overrides,
  }
}

function makeModel() {
  const doc = makeDoc()
  return {
    create: vi.fn().mockResolvedValue(doc),
    findById: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(doc) }),
    findByIdAndUpdate: vi.fn().mockResolvedValue(doc),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  }
}

function makeService() {
  const model = makeModel()
  const service = new JobsService(model as never)
  return { service, model }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => vi.clearAllMocks())

describe('JobsService.create', () => {
  it('creates a job with all 4 steps in pending state', async () => {
    const { service, model } = makeService()

    await service.create('alice')

    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'alice',
        status: 'pending',
        steps: STEP_NAMES.map((name) => ({ name, status: 'pending', count: 0 })),
      }),
    )
  })

  it('sets createdAt to an ISO 8601 string', async () => {
    const { service, model } = makeService()

    await service.create('alice')

    const arg = (model.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, unknown>
    expect(typeof arg['createdAt']).toBe('string')
    expect(() => new Date(arg['createdAt'] as string)).not.toThrow()
  })
})

describe('JobsService.markRunning', () => {
  it('sets status to running and records startedAt', async () => {
    const { service, model } = makeService()

    await service.markRunning('job-id-123')

    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      'job-id-123',
      expect.objectContaining({ status: 'running', startedAt: expect.any(String) }),
    )
  })
})

describe('JobsService.updateStep', () => {
  it('updates the matching step status to running', async () => {
    const { service, model } = makeService()

    await service.updateStep('job-id-123', 'issues', 'running')

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: 'job-id-123', 'steps.name': 'issues' },
      { $set: { 'steps.$.status': 'running' } },
    )
  })

  it('sets count when transitioning to done', async () => {
    const { service, model } = makeService()

    await service.updateStep('job-id-123', 'comments', 'done', 42)

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: 'job-id-123', 'steps.name': 'comments' },
      { $set: { 'steps.$.status': 'done', 'steps.$.count': 42 } },
    )
  })
})

describe('JobsService.markDone', () => {
  it('sets status to done and records completedAt', async () => {
    const { service, model } = makeService()

    await service.markDone('job-id-123')

    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      'job-id-123',
      expect.objectContaining({ status: 'done', completedAt: expect.any(String) }),
    )
  })
})

describe('JobsService.markFailed', () => {
  it('sets status to failed, records completedAt, and stores the error message', async () => {
    const { service, model } = makeService()

    await service.markFailed('job-id-123', 'rate limit exceeded')

    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      'job-id-123',
      expect.objectContaining({
        status: 'failed',
        completedAt: expect.any(String),
        error: 'rate limit exceeded',
      }),
    )
  })
})

describe('JobsService.findById', () => {
  it('returns the job document when found', async () => {
    const { service } = makeService()

    const result = await service.findById('job-id-123')

    expect(result).not.toBeNull()
    expect(result?.username).toBe('alice')
  })

  it('returns null when the job does not exist', async () => {
    const { service, model } = makeService()
    model.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })

    const result = await service.findById('nonexistent')

    expect(result).toBeNull()
  })
})
