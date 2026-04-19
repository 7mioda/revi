import { SkillRepository } from './skill.repository.js'
import type { SkillEntity } from '../../entities/index.js'

export class SkillRepositoryInMemory extends SkillRepository {
  private readonly store = new Map<string, SkillEntity>()
  private counter = 0

  async findByUserId(userId: string): Promise<SkillEntity[]> {
    return Array.from(this.store.values()).filter((e) => e.userId === userId)
  }

  async findByUsername(username: string): Promise<SkillEntity[]> {
    return Array.from(this.store.values()).filter((e) => e.username === username)
  }

  async findById(id: string): Promise<SkillEntity | null> {
    return this.store.get(id) ?? null
  }

  async save(skill: Omit<SkillEntity, 'id'>): Promise<SkillEntity> {
    const id = String(++this.counter)
    const entity = { ...skill, id }
    this.store.set(id, entity)
    return entity
  }

  async deleteManyByUserId(userId: string): Promise<void> {
    for (const [id, entity] of this.store.entries()) {
      if (entity.userId === userId) this.store.delete(id)
    }
  }

  async countGeneratedAfter(username: string, since: string): Promise<number> {
    return Array.from(this.store.values()).filter(
      (e) => e.username === username && e.generatedAt > since,
    ).length
  }

  async upsertByDimension(data: Omit<SkillEntity, 'id'>): Promise<void> {
    for (const [id, entity] of this.store.entries()) {
      if (entity.username === data.username && entity.dimension === data.dimension && entity.batchId === data.batchId) {
        this.store.set(id, { ...entity, name: data.name, content: data.content, tags: data.tags })
        return
      }
    }
    await this.save(data)
  }
}
