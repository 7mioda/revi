import type { ProfileEntity } from '../entities/profile.js'

export function buildProfile(overrides: Partial<ProfileEntity> = {}): ProfileEntity {
  return {
    id: '000000000000000000000001',
    username: 'alice',
    githubId: 1,
    avatarUrl: null,
    name: null,
    bio: null,
    company: null,
    location: null,
    email: null,
    blog: null,
    twitterUsername: null,
    followers: 0,
    following: 0,
    publicRepos: 0,
    githubCreatedAt: '2020-01-01T00:00:00Z',
    syncedAt: new Date().toISOString(),
    reviews: 0,
    avatar: null,
    ...overrides,
  }
}
