import type { SkillEntity } from '../../entities/index.js'
import type { SkillDocument } from '../persistence/skill.schema.js'

export class SkillMapper {
  static toEntity(doc: SkillDocument): SkillEntity {
    return {
      id: String(doc._id),
      name: doc.name,
      content: doc.content,
      tags: doc.tags,
      batchId: doc.batchId,
      generatedAt: doc.generatedAt,
      userId: doc.userId,
      username: doc.username,
      dimension: doc.dimension,
    }
  }
}
