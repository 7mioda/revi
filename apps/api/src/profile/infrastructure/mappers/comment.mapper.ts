import type { CommentEntity } from '../../entities/index.js'
import type { CommentDocument } from '../persistence/comment.schema.js'

export class CommentMapper {
  static toEntity(doc: CommentDocument): CommentEntity {
    return {
      id: String(doc._id),
      githubId: doc.githubId,
      username: doc.username,
      type: doc.type,
      body: doc.body,
      path: doc.path,
      diffHunk: doc.diffHunk,
      pullRequestNumber: doc.pullRequestNumber,
      repoOwner: doc.repoOwner,
      repoName: doc.repoName,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      userId: doc.userId,
    }
  }
}
