/**
 * Fetches all comments on individual commits for a repository.
 * Uses `GET /repos/{owner}/{repo}/comments` with automatic pagination.
 *
 * @param client - A configured `OctokitClient`.
 * @param owner - Repository owner (org or user login).
 * @param repo - Repository name.
 * @returns A list of normalised `GithubComment` objects tagged as `commit_comment`.
 */
export async function fetchCommitComments(client, owner, repo) {
    const raw = await client.paginate(client.rest.repos.listCommitCommentsForRepo, { owner, repo, per_page: 100 });
    return raw.map((comment) => ({
        githubId: comment.id,
        username: comment.user?.login ?? 'unknown',
        type: 'commit_comment',
        body: comment.body ?? '',
        path: null,
        diffHunk: null,
        pullRequestNumber: null,
        repoOwner: owner,
        repoName: repo,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
    }));
}
//# sourceMappingURL=fetch-commit-comments.js.map