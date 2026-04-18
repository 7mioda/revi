# Plan — Fetch Pull Request Diff Code

## Context

`GET /repos/{owner}/{repo}/pulls/{pull_number}/files` is the GitHub endpoint
that returns every changed file in a PR along with its `patch` field — the
raw unified diff for that file. This is the "PR diff code".

The logic exists today, but it is **duplicated** in two places as unexported,
unreusable private functions:

| Location | Function |
|----------|----------|
| `apps/api/src/scripts/review-pr.ts` (lines 288–305) | `fetchPRFiles()` |
| `apps/api/src/reviews/reviews.service.ts` (lines 124–141) | `fetchPRFiles()` private method |

The `PRFile` interface (`{ filename, status, patch? }`) is also duplicated in
both files and is not exported from `packages/octokit`.

This plan extracts the function and its type into `packages/octokit` so any
consumer can import them, then updates the two existing callers to use the
package export.

---

## Assumptions

1. "Fetch PR diff code" means `GET /repos/{owner}/{repo}/pulls/{pull_number}/files`
   — each item includes a `patch` field (unified diff string).
2. PRs can have more than 100 files (GitHub caps `per_page` at 100), so
   **pagination** must be used. The current callers both use a single request
   with `per_page: 100` — this is a silent bug for large PRs that the
   extracted function will fix by using `client.paginate`.
3. `patch` is optional in GitHub's response (binary files have no patch), so
   the type stays `patch?: string`.
4. The callers (`review-pr.ts` and `reviews.service.ts`) must be updated to
   remove the duplicate private implementations and import from `@revi/octokit`.

---

## Dependency graph

```
packages/octokit
  └── Task 1: PRFile type + fetchPRDiff function
          │
apps/api (consumers)
  ├── Task 2a: update review-pr.ts (script)
  └── Task 2b: update reviews.service.ts
```

Task 2a and 2b are independent of each other; both depend on Task 1.

---

## Task 1 — `packages/octokit`: add `PRFile` type + `fetchPRDiff`

### New type in `types.ts`

```ts
/**
 * A single file in a pull request's changeset, as returned by the GitHub
 * Files API (`GET /repos/{owner}/{repo}/pulls/{pull_number}/files`).
 */
export interface PRFile {
  /** Path of the changed file relative to the repository root. */
  filename: string
  /**
   * Change status: `'added'`, `'removed'`, `'modified'`, `'renamed'`,
   * `'copied'`, `'changed'`, or `'unchanged'`.
   */
  status: string
  /**
   * Unified diff patch for this file. Absent for binary files and files
   * where the diff is too large for GitHub to compute.
   */
  patch?: string
}
```

### New file `fetch-pr-diff.ts`

```ts
export async function fetchPRDiff(
  client: OctokitClient,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PRFile[]>
```

Uses `client.paginate(client.rest.pulls.listFiles, { owner, repo, pull_number: pullNumber, per_page: 100 })`.

Maps each item to `{ filename, status, patch: item.patch }`.

### `index.ts` update

Export `PRFile` type and `fetchPRDiff` function.

### Acceptance criteria

- `fetchPRDiff` is exported from `@revi/octokit`.
- `PRFile` is exported from `@revi/octokit`.
- No raw Octokit types cross the package boundary.
- Uses `client.paginate` (not a single `.request()` call) to handle PRs with
  more than 100 files.
- `yarn workspace @revi/octokit typecheck` passes (0 errors).

### Verification

```sh
yarn workspace @revi/octokit test    # new tests pass, existing 19 still pass
yarn workspace @revi/octokit typecheck  # 0 errors
```

---

## CHECKPOINT A — `@revi/octokit` complete

```sh
yarn workspace @revi/octokit typecheck   # must be 0 errors
yarn workspace @revi/octokit test        # all pass
```

---

## Task 2 — `apps/api`: use `fetchPRDiff` in both callers

### 2a — `apps/api/src/scripts/review-pr.ts`

1. Add `fetchPRDiff` and `PRFile` to the import from `@revi/octokit`.
2. Delete the local `PRFile` interface and the local `fetchPRFiles` function.
3. Replace the call `await fetchPRFiles(client, owner, repo, pullNumber)` with
   `await fetchPRDiff(client, owner, repo, pullNumber)`.
4. Update any reference to `PRFile` to use the imported type.

### 2b — `apps/api/src/reviews/reviews.service.ts`

1. Add `fetchPRDiff` and `PRFile` to the import from `@revi/octokit`.
2. Delete the local `PRFile` interface and the private `fetchPRFiles` method.
3. Replace `await this.fetchPRFiles(client, owner, repo, pullNumber)` with
   `await fetchPRDiff(client, owner, repo, pullNumber)`.
4. Update any reference to `PRFile` to use the imported type.

### Acceptance criteria

- `PRFile` is no longer defined in either `review-pr.ts` or `reviews.service.ts`.
- `fetchPRFiles` private method is removed from `ReviewsService`.
- `review-pr.ts` imports `fetchPRDiff` and `PRFile` from `@revi/octokit`.
- `reviews.service.ts` imports `fetchPRDiff` and `PRFile` from `@revi/octokit`.
- `yarn workspace @revi/api typecheck` passes (0 errors).
- `yarn workspace @revi/api test` shows no new failures (existing 2 config failures
  are pre-existing and unrelated).

### Verification

```sh
yarn workspace @revi/api typecheck   # 0 errors
yarn workspace @revi/api test        # same pass count as before Task 2
```

---

## CHECKPOINT B — Full workspace clean

```sh
yarn workspace @revi/octokit typecheck && yarn workspace @revi/api typecheck
# Both must be 0 errors
```

---

## Hard rules (inherited)

1. No `any`. No `!` without an inline explanatory comment.
2. JSDoc on every exported function and interface.
3. `packages/octokit` has zero NestJS imports.
4. All `.ts` imports use `.js` extensions (ESM Node resolution).
5. `yarn typecheck` must pass after every task.
