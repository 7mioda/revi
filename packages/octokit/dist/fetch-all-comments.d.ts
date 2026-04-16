import type { OctokitClient } from './client.js';
import type { GithubComment } from './types.js';
/**
 * Fetches all three comment sources for a repository in parallel and merges
 * them into a single array. Each comment is tagged with a `type` discriminant
 * so consumers can distinguish between `pr_review_comment`, `pr_comment`, and
 * `commit_comment` without inspecting the shape of each object.
 *
 * @param client - A configured `OctokitClient`.
 * @param owner - Repository owner (org or user login).
 * @param repo - Repository name.
 * @returns A merged array of `GithubComment` from all three API sources.
 */
export declare function fetchAllComments(client: OctokitClient, owner: string, repo: string): Promise<GithubComment[]>;
//# sourceMappingURL=fetch-all-comments.d.ts.map