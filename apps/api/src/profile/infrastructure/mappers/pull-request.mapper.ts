import type { PullRequestEntity } from '../../entities/index.js'
import type { PullRequestDocument } from '../persistence/pull-request.schema.js'

export class PullRequestMapper {
  static toEntity(doc: PullRequestDocument): PullRequestEntity {
    return {
      id: String(doc._id),
      githubId: doc.githubId,
      number: doc.number,
      title: doc.title,
      body: doc.body,
      state: doc.state,
      authorLogin: doc.authorLogin,
      repoOwner: doc.repoOwner,
      repoName: doc.repoName,
      labels: doc.labels,
      draft: doc.draft,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      closedAt: doc.closedAt,
      mergedAt: doc.mergedAt,
      files: doc.files,
      userId: doc.userId,
    }
  }
}
