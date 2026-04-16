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
 * Lightweight reference to a GitHub repository, owner + name only.
 */
export interface RepoRef {
    /** Repository owner (org or user login). */
    owner: string;
    /** Repository name without the owner prefix. */
    name: string;
}
//# sourceMappingURL=types.d.ts.map