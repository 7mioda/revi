import { ProfileJobRepository } from './profile-job.repository.js'
import { PROFILE_JOB_STEP_NAMES } from './profile-job.schema.js'
import type { ProfileJobStepName, ProfileJobStepStatus } from './profile-job.schema.js'
import type { ProfileJobEntity } from '../../entities/index.js'

export class ProfileJobRepositoryInMemory extends ProfileJobRepository {
  private readonly store = new Map<string, ProfileJobEntity>()
  private counter = 0

  async create(username: string): Promise<ProfileJobEntity> {
    const id = String(++this.counter)
    const entity: ProfileJobEntity = {
      id,
      username,
      status: 'pending',
      steps: PROFILE_JOB_STEP_NAMES.map((name) => ({ name, status: 'pending', count: 0 })),
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      error: null,
    }
    this.store.set(id, entity)
    return entity
  }

  async findById(id: string): Promise<ProfileJobEntity | null> {
    return this.store.get(id) ?? null
  }

  async markRunning(id: string): Promise<void> {
    const entity = this.store.get(id)
    if (entity) this.store.set(id, { ...entity, status: 'running', startedAt: new Date().toISOString() })
  }

  async updateStep(id: string, name: ProfileJobStepName, status: ProfileJobStepStatus, count?: number): Promise<void> {
    const entity = this.store.get(id)
    if (!entity) return
    const steps = entity.steps.map((s) =>
      s.name === name
        ? { ...s, status, ...(count !== undefined ? { count } : {}) }
        : s,
    )
    this.store.set(id, { ...entity, steps })
  }

  async markDone(id: string): Promise<void> {
    const entity = this.store.get(id)
    if (entity) this.store.set(id, { ...entity, status: 'done', completedAt: new Date().toISOString() })
  }

  async markFailed(id: string, error: string): Promise<void> {
    const entity = this.store.get(id)
    if (entity) this.store.set(id, { ...entity, status: 'failed', completedAt: new Date().toISOString(), error })
  }

  async findCompletedAfter(username: string, since: string): Promise<ProfileJobEntity[]> {
    return Array.from(this.store.values()).filter(
      (e) => e.username === username && e.status === 'done' && e.completedAt != null && e.completedAt > since,
    )
  }
}
