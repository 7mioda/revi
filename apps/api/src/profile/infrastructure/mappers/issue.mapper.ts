import type { IssueEntity } from '../../entities/index.js'
import type { IssueDocument } from '../persistence/issue.schema.js'

export class IssueMapper {
  static toEntity(doc: IssueDocument): IssueEntity {
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
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      closedAt: doc.closedAt,
      userId: doc.userId,
    }
  }
}
