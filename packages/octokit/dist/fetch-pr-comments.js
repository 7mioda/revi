/** Extracts the PR/issue number from a GitHub issue or pulls URL. */
function numberFromUrl(url) {
    if (url == null)
        return null;
    const match = /\/(?:issues|pulls)\/(\d+)$/.exec(url);
    if (match === null || match[1] === undefined)
        return null;
    return parseInt(match[1], 10);
}
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
export async function fetchPRComments(client, owner, repo) {
    const raw = await client.paginate(client.rest.issues.listCommentsForRepo, { owner, repo, per_page: 100 });
    return raw
        .filter((comment) => 'pull_request_url' in comment && typeof comment.pull_request_url === 'string')
        .map((comment) => ({
        githubId: comment.id,
        username: comment.user?.login ?? 'unknown',
        type: 'pr_comment',
        body: comment.body ?? '',
        path: null,
        diffHunk: null,
        pullRequestNumber: numberFromUrl(comment.pull_request_url),
        repoOwner: owner,
        repoName: repo,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
    }));
}
//# sourceMappingURL=fetch-pr-comments.js.map