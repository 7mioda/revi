# Task List — Fetch User Activity (Issues, PRs, Comments)

## Phase 1: packages/octokit

- [ ] **Task 1** — Make `token` optional in `createOctokitClient` (`client.ts`)
- [ ] **Task 2** — Add `GithubIssue` + `GithubPullRequest` types (`types.ts`, `index.ts`)
- [ ] **Task 3** — `fetchUserIssues` — search API, author:{username} type:issue
- [ ] **Task 4** — `fetchUserPullRequests` — search API, author:{username} type:pr
- [ ] **CHECKPOINT A** — `yarn workspace @revi/octokit typecheck` = 0 errors

---

## Phase 2: apps/api

- [ ] **Task 5** — `issue.schema.ts` + `pull-request.schema.ts` (Mongoose, unique githubId index)
- [ ] **Task 6** — `UserActivityService.fetchAndSave` — 4-step pipeline, progressive upsert
- [ ] **Task 7** — Wire schemas + service into `UsersModule`; add `POST /users/:username/activity`
- [ ] **CHECKPOINT B** — Smoke test passes (public + authenticated paths)
