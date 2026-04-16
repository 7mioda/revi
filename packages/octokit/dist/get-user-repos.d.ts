import type { OctokitClient } from './client.js';
import type { RepoRef } from './types.js';
/**
 * Lists all repositories owned by a GitHub user, using automatic pagination.
 * Uses `GET /users/{username}/repos`.
 *
 * @param client - A configured `OctokitClient`.
 * @param username - The GitHub login of the user whose repos to list.
 * @returns A list of `RepoRef` objects (owner + name pairs).
 */
export declare function getUserRepos(client: OctokitClient, username: string): Promise<RepoRef[]>;
//# sourceMappingURL=get-user-repos.d.ts.map