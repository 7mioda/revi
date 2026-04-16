import type { OctokitClient } from './client.js';
import type { GithubComment } from './types.js';
/**
 * Fetches all inline diff-level review comments for a repository.
 * Uses `GET /repos/{owner}/{repo}/pulls/comments` with automatic pagination.
 *
 * @param client - A configured `OctokitClient`.
 * @param owner - Repository owner (org or user login).
 * @param repo - Repository name.
 * @returns A list of normalised `GithubComment` objects tagged as `pr_review_comment`.
 */
export declare function fetchPRReviewComments(client: OctokitClient, owner: string, repo: string): Promise<GithubComment[]>;
//# sourceMappingURL=fetch-pr-review-comments.d.ts.map