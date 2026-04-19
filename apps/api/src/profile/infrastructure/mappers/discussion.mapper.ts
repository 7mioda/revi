import type { DiscussionEntity } from '../../entities/index.js'
import type { DiscussionDocument } from '../persistence/discussion.schema.js'

export class DiscussionMapper {
  static toEntity(doc: DiscussionDocument): DiscussionEntity {
    return {
      id: String(doc._id),
      githubId: doc.githubId,
      title: doc.title,
      body: doc.body,
      repoOwner: doc.repoOwner,
      repoName: doc.repoName,
      authorLogin: doc.authorLogin,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      username: doc.username,
      userId: doc.userId,
    }
  }
}
