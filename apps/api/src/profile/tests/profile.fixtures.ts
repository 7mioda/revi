import { buildProfile } from '../factories/profile.factory.js'
import type { ProfileEntity } from '../entities/index.js'

export const fixtureProfile: ProfileEntity = buildProfile({
  id: 'profile-1',
  username: 'alice',
  githubId: 12345,
  followers: 100,
  following: 50,
  publicRepos: 20,
})

export const fixtureProfile2: ProfileEntity = buildProfile({
  id: 'profile-2',
  username: 'bob',
  githubId: 67890,
  followers: 200,
  following: 75,
  publicRepos: 35,
})
