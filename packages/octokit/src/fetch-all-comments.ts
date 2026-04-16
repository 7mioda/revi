import type { OctokitClient } from './client.js'
import type { GithubComment } from './types.js'
import { fetchCommitComments } from './fetch-commit-comments.js'
import { fetchPRComments } from './fetch-pr-comments.js'
import { fetchPRReviewComments } from './fetch-pr-review-comments.js'

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
export async function fetchAllComments(
  client: OctokitClient,
  owner: string,
  repo: string,
): Promise<GithubComment[]> {
  const [reviewComments, prComments, commitComments] = await Promise.all([
    fetchPRReviewComments(client, owner, repo),
    fetchPRComments(client, owner, repo),
    fetchCommitComments(client, owner, repo),
  ])

  return [...reviewComments, ...prComments, ...commitComments]
}
