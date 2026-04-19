import { DiscussionRepository } from './discussion.repository.js'
import type { DiscussionEntity } from '../../entities/index.js'

export class DiscussionRepositoryInMemory extends DiscussionRepository {
  private readonly store = new Map<string, DiscussionEntity>()
  private counter = 0

  async findByUsername(username: string): Promise<DiscussionEntity[]> {
    return Array.from(this.store.values()).filter((e) => e.username === username)
  }

  async upsert(data: Omit<DiscussionEntity, 'id'>): Promise<void> {
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
