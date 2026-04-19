import { CommentRepository } from './comment.repository.js'
import type { CommentEntity } from '../../entities/index.js'

export class CommentRepositoryInMemory extends CommentRepository {
  private readonly store = new Map<string, CommentEntity>()
  private counter = 0

  async findByUserId(userId: string): Promise<CommentEntity[]> {
    return Array.from(this.store.values()).filter((e) => e.userId === userId)
  }

  async findByUsername(username: string): Promise<CommentEntity[]> {
    return Array.from(this.store.values()).filter((e) => e.username === username)
  }

  async upsert(data: Omit<CommentEntity, 'id'>): Promise<void> {
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
