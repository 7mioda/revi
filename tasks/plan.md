# Implementation Plan — pr-style-cloner

## Context

Fresh yarn workspace monorepo (single init commit, empty `packages/`, no `apps/`, no TypeScript
config). Building two workspaces per CLAUDE.md: `@revi/octokit` (plain TS GitHub API wrapper)
and `@revi/api` (NestJS HTTP server).

The repo was initialized with Yarn PnP (`.pnp.cjs` exists) but CLAUDE.md requires
`nodeLinker: node-modules` — the first task switches the linker before anything else is built.

---

## Dependency graph

```
Root monorepo config (.yarnrc.yml, root package.json, tsconfig.base.json)
    └── packages/octokit   (zero internal deps — plain TS library)
            └── apps/api   (imports @revi/octokit — NestJS app)
```

---

## Task 1 — Monorepo infrastructure

**Files to create/edit:**
- `.yarnrc.yml` — `nodeLinker: node-modules`
- `package.json` (root) — add `"apps/*"` to workspaces array
- `tsconfig.base.json` (root) — strict mode, ESM (`module: NodeNext`, `moduleResolution: NodeNext`)

**Acceptance criteria:**
- `yarn install` succeeds with `node_modules/` layout (no PnP)
- `tsconfig.base.json` rejects non-strict code

**Verification:** `yarn install && ls node_modules | head`

---

## Task 2 — packages/octokit: scaffold, types, client factory

**Files to create:**
- `packages/octokit/package.json` — name `@revi/octokit`, `"type": "module"`
- `packages/octokit/tsconfig.json` — extends `../../tsconfig.base.json`
- `packages/octokit/src/types.ts` — exported interfaces:
  - `GithubComment` — `githubId`, `username`, `type` (discriminant union), `body`, `path`,
    `diffHunk`, `pullRequestNumber`, `repoOwner`, `repoName`, `createdAt`, `updatedAt`
  - `RepoRef` — `owner`, `name`
  - `OctokitClient` — composed type returned by `createOctokitClient`
- `packages/octokit/src/client.ts` — `createOctokitClient(token: string)` with plugins:
  - `@octokit/plugin-paginate-rest`
  - `@octokit/plugin-retry`
  - `@octokit/plugin-throttling` (log + retry on rate limits, no throw)
- `packages/octokit/src/index.ts` — re-exports all public API

**Dependencies:** `@octokit/rest @octokit/plugin-paginate-rest @octokit/plugin-retry @octokit/plugin-throttling`

**Acceptance criteria:**
- No `any`, no `!` assertions
- `createOctokitClient` exported and typed
- `yarn workspace @revi/octokit typecheck` passes

---

## Task 3 — packages/octokit: fetch functions

**Files to create:**
- `packages/octokit/src/fetch-pr-review-comments.ts`
  — `GET /repos/{owner}/{repo}/pulls/comments` → `GithubComment[]` (type: `pr_review_comment`)
- `packages/octokit/src/fetch-pr-comments.ts`
  — `GET /repos/{owner}/{repo}/issues/comments`, filter where `pull_request` field present
  → `GithubComment[]` (type: `pr_comment`)
- `packages/octokit/src/fetch-commit-comments.ts`
  — `GET /repos/{owner}/{repo}/comments` → `GithubComment[]` (type: `commit_comment`)
- `packages/octokit/src/fetch-all-comments.ts`
  — `Promise.all` of all three, merged → `GithubComment[]`
- `packages/octokit/src/get-user-repos.ts`
  — `GET /users/{username}/repos` paginated → `RepoRef[]`
- Update `index.ts` to export all five functions

**Acceptance criteria:**
- All functions take `(client: OctokitClient, ...)` — token never leaks out
- No Octokit internal types cross the package boundary
- JSDoc on every exported function and interface
- `yarn workspace @revi/octokit typecheck` passes

---

## CHECKPOINT A — @revi/octokit complete

```sh
yarn workspace @revi/octokit typecheck   # must be zero errors
```

Do not proceed to `apps/api` until this is clean.

---

## Task 4 — apps/api: scaffold + bootstrap + ConfigModule

**Files to create:**
- `apps/api/package.json` — name `@revi/api`, `"type": "module"`, dep on `@revi/octokit`
- `apps/api/tsconfig.json` — extends `../../tsconfig.base.json`, adds `emitDecoratorMetadata: true`
- `apps/api/src/config.ts` — Zod schema: `GITHUB_TOKEN` (required string), `PORT` (optional, default 3000)
- `apps/api/src/app.module.ts` — `AppModule` with global `ConfigModule` using Zod validate fn
- `apps/api/src/main.ts` — bootstrap with global `ValidationPipe` + global `HttpExceptionFilter`

**Dependencies:**
```
@nestjs/core @nestjs/common @nestjs/platform-express @nestjs/config
class-validator class-transformer reflect-metadata rxjs zod
```

**Acceptance criteria:**
- `GITHUB_TOKEN=x yarn workspace @revi/api start` → boots on port 3000
- Missing `GITHUB_TOKEN` → Zod validation error, process exits non-zero
- `ValidationPipe` configured `whitelist: true, forbidNonWhitelisted: true`

---

## Task 5 — apps/api: GithubModule + GET /github/:username/repos

**Files to create:**
- `apps/api/src/github/github.module.ts`
- `apps/api/src/github/github.service.ts` — injects `ConfigService`, creates `OctokitClient`,
  wraps `getUserRepos`
- `apps/api/src/github/github.controller.ts` — `GET /github/:username/repos`
- `apps/api/src/github/http-exception.filter.ts` — maps GitHub errors:
  - 401 → HTTP 401
  - 403 / rate-limit → HTTP 429, message `"GitHub rate limit exceeded"`
  - 404 → HTTP 404
  - other → HTTP 502

Register `GithubModule` in `AppModule`. Register filter globally in `main.ts`.

**Response:**
```json
{ "username": "string", "repos": [{ "owner": "string", "name": "string" }] }
```

**Acceptance criteria:**
- `GET /github/octocat/repos` returns valid JSON
- Unknown username → HTTP 404

---

## Task 6 — apps/api: POST /github/:username/comments

**Files to create:**
- `apps/api/src/github/dto/fetch-comments.dto.ts` — `FetchCommentsDto`:
  - `@IsOptional() @IsArray() @IsString({ each: true }) repos?: string[]`
  - `@IsOptional() @IsInt() @Min(1) maxPages?: number`

**Add to GithubService:**
- `fetchComments(username, repos?, maxPages?, token?)`:
  - If no repos, call `getUserRepos` first
  - Call `fetchAllComments` for each repo (honours `maxPages`)
  - Per-request token override builds a fresh `OctokitClient`

**Add to GithubController:**
- `POST /github/:username/comments` — reads `Authorization: Bearer <token>` header, passes to service

**Response:**
```json
{
  "username": "string",
  "fetched": 142,
  "breakdown": { "pr_review_comment": 80, "pr_comment": 50, "commit_comment": 12 },
  "comments": [ ...GithubComment[] ]
}
```

**Acceptance criteria:**
- POST with empty body fetches all repos and all comments
- POST with `{ "repos": ["owner/repo"] }` restricts scope
- `Authorization` header overrides server-level token
- `yarn typecheck` passes across entire workspace

---

## CHECKPOINT B — full end-to-end

```sh
yarn typecheck   # zero errors across all workspaces

# In one terminal:
GITHUB_TOKEN=<pat> yarn workspace @revi/api start

# In another:
curl http://localhost:3000/github/octocat/repos
curl -X POST http://localhost:3000/github/octocat/comments \
  -H 'Content-Type: application/json' \
  -d '{}'
```

Both must return well-formed JSON matching the specified response shapes.

---

## Hard rules (from CLAUDE.md)

1. No `any`. No `!` without an inline comment explaining why.
2. JSDoc on every exported function and interface.
3. `packages/octokit` has zero NestJS imports.
4. `apps/api` has zero business logic — NestJS wiring only.
5. All `.ts` imports use `.js` extensions (ESM Node resolution).
6. Cross-package imports use package name (`@revi/octokit`), never relative `../../` paths.
7. `yarn typecheck` must pass after every task before moving to the next.
