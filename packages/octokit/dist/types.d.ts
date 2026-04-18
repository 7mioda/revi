/**
 * Discriminant union for the three comment sources GitHub exposes.
 */
export type CommentType = 'pr_review_comment' | 'pr_comment' | 'commit_comment';
/**
 * A normalised GitHub comment with all fields needed for downstream analysis.
 * Nullable fields are those that only apply to specific comment types.
 */
export interface GithubComment {
    /** The numeric GitHub ID of the comment. */
    githubId: number;
    /** GitHub login of the comment author. */
    username: string;
    /** Discriminant identifying which GitHub API this comment came from. */
    type: CommentType;
    /** Raw Markdown body of the comment. */
    body: string;
    /** File path the comment is anchored to, if any (PR review comments only). */
    path: string | null;
    /** Raw diff hunk the comment was placed on (PR review comments only). */
    diffHunk: string | null;
    /** Pull request number this comment belongs to, if applicable. */
    pullRequestNumber: number | null;
    /** Owner (org or user) of the repository. */
    repoOwner: string;
    /** Repository name (without the owner prefix). */
    repoName: string;
    /** ISO 8601 creation timestamp. */
    createdAt: string;
    /** ISO 8601 last-updated timestamp. */
    updatedAt: string;
}
/**
 * The authenticated GitHub user identified by a personal access token.
 * Returned by `getAuthenticatedUser`.
 */
export interface AuthenticatedUser {
    /** GitHub login (username) of the token owner. */
    login: string;
    /** Numeric GitHub user ID. */
    id: number;
}
/**
 * Lightweight reference to a GitHub repository, owner + name only.
 */
export interface RepoRef {
    /** Repository owner (org or user login). */
    owner: string;
    /** Repository name without the owner prefix. */
    name: string;
}
/**
 * A GitHub issue authored by the user, normalised from the Search API response.
 */
export interface GithubIssue {
    /** The numeric GitHub ID of the issue. */
    githubId: number;
    /** Issue number within the repository. */
    number: number;
    /** Issue title. */
    title: string;
    /** Raw Markdown body of the issue, or null if empty. */
    body: string | null;
    /** Current state of the issue. */
    state: 'open' | 'closed';
    /** GitHub login of the issue author. */
    authorLogin: string;
    /** Owner (org or user) of the repository. */
    repoOwner: string;
    /** Repository name (without the owner prefix). */
    repoName: string;
    /** Names of labels applied to the issue. */
    labels: string[];
    /** ISO 8601 creation timestamp. */
    createdAt: string;
    /** ISO 8601 last-updated timestamp. */
    updatedAt: string;
    /** ISO 8601 closed timestamp, or null if still open. */
    closedAt: string | null;
}
/**
 * A single file in a pull request's changeset, as returned by
 * `GET /repos/{owner}/{repo}/pulls/{pull_number}/files`.
 */
export interface PRFile {
    /** Path of the changed file relative to the repository root. */
    filename: string;
    /**
     * Change status reported by GitHub: `'added'`, `'removed'`, `'modified'`,
     * `'renamed'`, `'copied'`, `'changed'`, or `'unchanged'`.
     */
    status: string;
    /**
     * Unified diff patch for this file. Absent for binary files and files
     * whose diff exceeds GitHub's size limit.
     */
    patch?: string;
}
/**
 * GitHub public profile metadata for a user, returned by `GET /users/{username}`.
 */
export interface GithubUser {
    login: string;
    githubId: number;
    avatarUrl: string | null;
    name: string | null;
    bio: string | null;
    company: string | null;
    location: string | null;
    email: string | null;
    blog: string | null;
    twitterUsername: string | null;
    followers: number;
    following: number;
    publicRepos: number;
    /** ISO 8601 timestamp when the GitHub account was created. */
    githubCreatedAt: string;
}
/**
 * A GitHub Discussion authored by the user, fetched via the GraphQL API.
 */
export interface GithubDiscussion {
    /** Global node ID from GitHub GraphQL (string, not numeric). */
    githubId: string;
    title: string;
    body: string | null;
    repoOwner: string;
    repoName: string;
    authorLogin: string;
    createdAt: string;
    updatedAt: string;
}
/**
 * A GitHub pull request authored by the user, normalised from the Search API response.
 * `state` is `'merged'` when `mergedAt` is set, otherwise mirrors the raw API state.
 */
export interface GithubPullRequest {
    /** The numeric GitHub ID of the pull request. */
    githubId: number;
    /** PR number within the repository. */
    number: number;
    /** PR title. */
    title: string;
    /** Raw Markdown body of the PR, or null if empty. */
    body: string | null;
    /** Current state of the PR. `'merged'` is derived from `mergedAt`. */
    state: 'open' | 'closed' | 'merged';
    /** GitHub login of the PR author. */
    authorLogin: string;
    /** Owner (org or user) of the repository. */
    repoOwner: string;
    /** Repository name (without the owner prefix). */
    repoName: string;
    /** Names of labels applied to the PR. */
    labels: string[];
    /** Whether the PR is a draft. */
    draft: boolean;
    /** ISO 8601 creation timestamp. */
    createdAt: string;
    /** ISO 8601 last-updated timestamp. */
    updatedAt: string;
    /** ISO 8601 closed timestamp, or null if still open. */
    closedAt: string | null;
    /** ISO 8601 merged timestamp, or null if not yet merged. */
    mergedAt: string | null;
}
//# sourceMappingURL=types.d.ts.map