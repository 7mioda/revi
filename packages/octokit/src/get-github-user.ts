import type { OctokitClient } from './client.js'
import type { GithubUser } from './types.js'

/**
 * Fetches public profile metadata for a GitHub user via `GET /users/{username}`.
 *
 * @param client   - A configured `OctokitClient`.
 * @param username - The GitHub login to look up.
 * @returns A `GithubUser` object with profile metadata.
 */
export async function getGithubUser(client: OctokitClient, username: string): Promise<GithubUser> {
  const { data } = await client.rest.users.getByUsername({ username })
  return {
    login: data.login,
    githubId: data.id,
    avatarUrl: data.avatar_url ?? null,
    name: data.name ?? null,
    bio: data.bio ?? null,
    company: data.company ?? null,
    location: data.location ?? null,
    email: data.email ?? null,
    blog: data.blog ?? null,
    twitterUsername: data.twitter_username ?? null,
    followers: data.followers ?? 0,
    following: data.following ?? 0,
    publicRepos: data.public_repos ?? 0,
    githubCreatedAt: data.created_at,
  }
}
