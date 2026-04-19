import type { PreferenceEntity } from '../../entities/index.js'
import type { PreferenceDocument } from '../persistence/preference.schema.js'

export class PreferenceMapper {
  static toEntity(doc: PreferenceDocument): PreferenceEntity {
    return {
      id: String(doc._id),
      name: doc.name,
      dimension: doc.dimension,
      content: doc.content,
      tags: doc.tags,
      evolution: doc.evolution,
      batchId: doc.batchId,
      generatedAt: doc.generatedAt,
      userId: doc.userId,
      username: doc.username,
    }
  }
}
