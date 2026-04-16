# Task List — pr-style-cloner

## Phase 1: Monorepo infrastructure

- [ ] **Task 1** — Monorepo infrastructure
  - Create `.yarnrc.yml` (`nodeLinker: node-modules`)
  - Add `"apps/*"` to workspaces in root `package.json`
  - Create root `tsconfig.base.json` (strict, ESM NodeNext)
  - Verify: `yarn install && ls node_modules | head`

---

## Phase 2: @revi/octokit

- [ ] **Task 2** — packages/octokit: scaffold, types, client factory
  - `packages/octokit/package.json`
  - `packages/octokit/tsconfig.json`
  - `packages/octokit/src/types.ts` (GithubComment, RepoRef, OctokitClient)
  - `packages/octokit/src/client.ts` (createOctokitClient + all 3 plugins)
  - `packages/octokit/src/index.ts`
  - Install: `@octokit/rest @octokit/plugin-paginate-rest @octokit/plugin-retry @octokit/plugin-throttling`
  - Verify: `yarn workspace @revi/octokit typecheck`

- [ ] **Task 3** — packages/octokit: fetch functions
  - `fetch-pr-review-comments.ts`
  - `fetch-pr-comments.ts` (filtered to PRs)
  - `fetch-commit-comments.ts`
  - `fetch-all-comments.ts` (parallel, tagged)
  - `get-user-repos.ts`
  - Update `index.ts`
  - Verify: `yarn workspace @revi/octokit typecheck`

- [ ] **CHECKPOINT A** — `yarn workspace @revi/octokit typecheck` = 0 errors

---

## Phase 3: @revi/api

- [ ] **Task 4** — apps/api: scaffold + bootstrap + ConfigModule
  - `apps/api/package.json`
  - `apps/api/tsconfig.json`
  - `apps/api/src/config.ts` (Zod env schema)
  - `apps/api/src/app.module.ts` (global ConfigModule)
  - `apps/api/src/main.ts` (ValidationPipe + HttpExceptionFilter + bootstrap)
  - Install NestJS + class-validator + zod deps
  - Verify: boots with GITHUB_TOKEN set; exits on missing token

- [ ] **Task 5** — apps/api: GithubModule + GET /github/:username/repos
  - `github.module.ts`
  - `github.service.ts` (getUserRepos wrapper)
  - `github.controller.ts` (GET /github/:username/repos)
  - `http-exception.filter.ts` (401/429/404/502 mapping)
  - Register in AppModule + main.ts
  - Verify: `GET /github/octocat/repos` returns JSON

- [ ] **Task 6** — apps/api: POST /github/:username/comments
  - `dto/fetch-comments.dto.ts` (FetchCommentsDto)
  - GithubService.fetchComments (auto-discover repos, per-request token)
  - POST /github/:username/comments route (Auth header override)
  - Verify: POST returns `{ username, fetched, breakdown, comments }`

- [ ] **CHECKPOINT B** — `yarn typecheck` (root) = 0 errors; both endpoints return correct shapes
