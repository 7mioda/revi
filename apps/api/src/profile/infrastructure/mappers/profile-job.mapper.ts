import type { ProfileJobEntity } from '../../entities/index.js'
import type { ProfileJobDocument } from '../persistence/profile-job.schema.js'

export class ProfileJobMapper {
  static toEntity(doc: ProfileJobDocument): ProfileJobEntity {
    return {
      id: String(doc._id),
      username: doc.username,
      status: doc.status,
      steps: doc.steps.map((s) => ({ name: s.name, status: s.status, count: s.count })),
      createdAt: doc.createdAt,
      startedAt: doc.startedAt,
      completedAt: doc.completedAt,
      error: doc.error,
    }
  }
}
