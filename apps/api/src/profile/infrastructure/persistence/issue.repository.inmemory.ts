import { IssueRepository } from './issue.repository.js'
import type { IssueEntity } from '../../entities/index.js'

export class IssueRepositoryInMemory extends IssueRepository {
  private readonly store = new Map<string, IssueEntity>()
  private counter = 0

  async findByUsername(username: string): Promise<IssueEntity[]> {
    return Array.from(this.store.values()).filter((e) => e.authorLogin === username)
  }

  async upsert(data: Omit<IssueEntity, 'id'>): Promise<void> {
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
