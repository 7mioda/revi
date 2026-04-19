import { PreferenceRepository } from './preference.repository.js'
import type { PreferenceEntity } from '../../entities/index.js'

export class PreferenceRepositoryInMemory extends PreferenceRepository {
  private readonly store = new Map<string, PreferenceEntity>()
  private counter = 0

  async findByUserId(userId: string): Promise<PreferenceEntity[]> {
    return Array.from(this.store.values()).filter((e) => e.userId === userId)
  }

  async findByUsername(username: string): Promise<PreferenceEntity[]> {
    return Array.from(this.store.values()).filter((e) => e.username === username)
  }

  async save(pref: Omit<PreferenceEntity, 'id'>): Promise<PreferenceEntity> {
    const id = String(++this.counter)
    const entity = { ...pref, id }
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
}
