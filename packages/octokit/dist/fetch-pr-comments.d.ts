import type { OctokitClient } from './client.js';
import type { GithubComment } from './types.js';
/**
 * Fetches top-level PR conversation comments for a repository.
 * Uses `GET /repos/{owner}/{repo}/issues/comments` and filters to comments
 * that belong to pull requests (identified by the presence of `pull_request_url`).
 *
 * @param client - A configured `OctokitClient`.
 * @param owner - Repository owner (org or user login).
 * @param repo - Repository name.
 * @returns A list of normalised `GithubComment` objects tagged as `pr_comment`.
 */
export declare function fetchPRComments(client: OctokitClient, owner: string, repo: string): Promise<GithubComment[]>;
//# sourceMappingURL=fetch-pr-comments.d.ts.map