import type { ProfileEntity } from '../../entities/index.js'
import type { ProfileDocument } from '../persistence/profile.schema.js'

export class ProfileMapper {
  static toEntity(doc: ProfileDocument): ProfileEntity {
    return {
      id: String(doc._id),
      username: doc.username,
      githubId: doc.githubId,
      avatarUrl: doc.avatarUrl,
      name: doc.name,
      bio: doc.bio,
      company: doc.company,
      location: doc.location,
      email: doc.email,
      blog: doc.blog,
      twitterUsername: doc.twitterUsername,
      followers: doc.followers,
      following: doc.following,
      publicRepos: doc.publicRepos,
      githubCreatedAt: doc.githubCreatedAt,
      syncedAt: doc.syncedAt,
      reviews: doc.reviews,
      avatar: doc.avatar,
    }
  }
}
