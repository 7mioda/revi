import { PullRequestRepository } from './pull-request.repository.js'
import type { PullRequestEntity } from '../../entities/index.js'

export class PullRequestRepositoryInMemory extends PullRequestRepository {
  private readonly store = new Map<string, PullRequestEntity>()
  private counter = 0

  async findByUsername(username: string): Promise<PullRequestEntity[]> {
    return Array.from(this.store.values()).filter((e) => e.authorLogin === username)
  }

  async upsert(data: Omit<PullRequestEntity, 'id'>): Promise<void> {
    for (const [id, entity] of this.store.entries()) {
      if (entity.githubId === data.githubId) {
        this.store.set(id, { ...entity, ...data })
        return
      }
    }
    const id = String(++this.counter)
    this.store.set(id, { ...data, id })
  }
}
