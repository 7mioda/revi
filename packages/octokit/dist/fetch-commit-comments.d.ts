import type { OctokitClient } from './client.js';
import type { GithubComment } from './types.js';
/**
 * Fetches all comments on individual commits for a repository.
 * Uses `GET /repos/{owner}/{repo}/comments` with automatic pagination.
 *
 * @param client - A configured `OctokitClient`.
 * @param owner - Repository owner (org or user login).
 * @param repo - Repository name.
 * @returns A list of normalised `GithubComment` objects tagged as `commit_comment`.
 */
export declare function fetchCommitComments(client: OctokitClient, owner: string, repo: string): Promise<GithubComment[]>;
//# sourceMappingURL=fetch-commit-comments.d.ts.map