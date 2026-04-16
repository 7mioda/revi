/** Extracts the pull request number from a GitHub pulls URL. */
function prNumberFromUrl(url) {
    if (url == null)
        return null;
    const match = /\/pulls\/(\d+)$/.exec(url);
    if (match === null || match[1] === undefined)
        return null;
    return parseInt(match[1], 10);
}
/**
 * Fetches all inline diff-level review comments for a repository.
 * Uses `GET /repos/{owner}/{repo}/pulls/comments` with automatic pagination.
 *
 * @param client - A configured `OctokitClient`.
 * @param owner - Repository owner (org or user login).
 * @param repo - Repository name.
 * @returns A list of normalised `GithubComment` objects tagged as `pr_review_comment`.
 */
export async function fetchPRReviewComments(client, owner, repo) {
    const raw = await client.paginate(client.rest.pulls.listReviewCommentsForRepo, { owner, repo, per_page: 100 });
    return raw.map((comment) => ({
        githubId: comment.id,
        username: comment.user?.login ?? 'unknown',
        type: 'pr_review_comment',
        body: comment.body ?? '',
        path: comment.path ?? null,
        diffHunk: comment.diff_hunk,
        pullRequestNumber: prNumberFromUrl(comment.pull_request_url),
        repoOwner: owner,
        repoName: repo,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
    }));
}
//# sourceMappingURL=fetch-pr-review-comments.js.map