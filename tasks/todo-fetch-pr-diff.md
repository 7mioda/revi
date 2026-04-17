# Task List — Fetch PR Diff Code

## Phase 1: packages/octokit

- [x] **Task 1** — Add `PRFile` type to `types.ts`; create `fetch-pr-diff.ts` with `fetchPRDiff`; export both from `index.ts`
- [x] **CHECKPOINT A** — `yarn workspace @revi/octokit typecheck` + `test` both clean ✓

---

## Phase 2: apps/api (consumers)

- [x] **Task 2a** — Update `review-pr.ts`: import `fetchPRDiff` + `PRFile` from `@revi/octokit`, delete local duplicates
- [x] **Task 2b** — Update `reviews.service.ts`: same — import from package, remove private method
- [x] **CHECKPOINT B** — Both workspaces typecheck clean; no new test failures ✓
