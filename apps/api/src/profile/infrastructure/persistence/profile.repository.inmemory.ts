import { ProfileRepository } from './profile.repository.js'
import type { ProfileEntity } from '../../entities/index.js'

export class ProfileRepositoryInMemory extends ProfileRepository {
  private readonly store = new Map<string, ProfileEntity>()
  private counter = 0

  async findByUsername(username: string): Promise<ProfileEntity | null> {
    for (const entity of this.store.values()) {
      if (entity.username === username) return entity
    }
    return null
  }

  async findById(id: string): Promise<ProfileEntity | null> {
    return this.store.get(id) ?? null
  }

  async list(): Promise<ProfileEntity[]> {
    return Array.from(this.store.values()).sort((a, b) => b.followers - a.followers)
  }

  async upsert(data: Omit<ProfileEntity, 'id'>): Promise<ProfileEntity> {
    for (const [id, entity] of this.store.entries()) {
      if (entity.username === data.username) {
        const updated = { ...entity, ...data, id }
        this.store.set(id, updated)
        return updated
      }
    }
    const id = String(++this.counter)
    const created = { ...data, id }
    this.store.set(id, created)
    return created
  }

  async update(id: string, data: Partial<Omit<ProfileEntity, 'id'>>): Promise<void> {
    const existing = this.store.get(id)
    if (existing) this.store.set(id, { ...existing, ...data })
  }

  async incrementReviews(id: string): Promise<void> {
    const existing = this.store.get(id)
    if (existing) this.store.set(id, { ...existing, reviews: existing.reviews + 1 })
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id)
  }
}
