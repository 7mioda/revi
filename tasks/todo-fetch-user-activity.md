# Task List — Fetch User Activity (Issues, PRs, Comments)

## Phase 1: packages/octokit

- [x] **Task 1** — Make `token` optional in `createOctokitClient` (`client.ts`)
- [x] **Task 2** — Add `GithubIssue` + `GithubPullRequest` types (`types.ts`, `index.ts`)
- [x] **Task 3** — `fetchUserIssues` — search API, author:{username} type:issue
- [x] **Task 4** — `fetchUserPullRequests` — search API, author:{username} type:pr
- [x] **CHECKPOINT A** — `yarn workspace @revi/octokit typecheck` = 0 errors ✓

---

## Phase 2: apps/api

- [x] **Task 5** — `issue.schema.ts` + `pull-request.schema.ts` (Mongoose, unique githubId index)
- [x] **Task 6** — `UserActivityService.fetchAndSave` — 4-step pipeline, progressive upsert
- [x] **Task 7** — Wire schemas + service into `UsersModule`; add `POST /users/:username/activity`
- [x] **CHECKPOINT B** — Both workspaces typecheck clean; 72 tests pass (2 pre-existing config failures unrelated to this feature) ✓
