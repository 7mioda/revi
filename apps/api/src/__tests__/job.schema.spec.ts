import 'reflect-metadata'
import { describe, it, expect } from 'vitest'

describe('ActivityJob schema', () => {
  it('exports ActivityJob class and ActivityJobSchema', async () => {
    const mod = await import('../users/job.schema.js')
    expect(typeof mod.ActivityJob).toBe('function')
    expect(mod.ActivityJobSchema).toBeDefined()
  })

  it('exports the four step names as a constant', async () => {
    const { STEP_NAMES } = await import('../users/job.schema.js')
    expect(STEP_NAMES).toEqual(['issues', 'pullRequests', 'repos', 'comments'])
  })
})
