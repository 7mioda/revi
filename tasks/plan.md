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
                    └── apps/web  (Next.js 15 + Tailwind CSS v4 — standalone tsconfig)
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

## Task 7 — apps/api: fetch-my-comments CLI script

**Files to create:**
- `apps/api/src/scripts/fetch-my-comments.ts` — CLI that:
  - Reads `GITHUB_TOKEN` from env
  - Calls `getAuthenticatedUser` → `listAccessibleRepos` → `fetchAllComments` per repo
  - Filters to only the authenticated user's own comments
  - Writes `apps/api/output/my-comments.json`

**Acceptance criteria:**
- `GITHUB_TOKEN=<pat> yarn workspace @revi/api fetch-my-comments` writes output file
- Output schema matches `data.json` (user, fetchedAt, totalRepos, totalComments, comments[])

---

## Task 8 — apps/api: POST /me/comments → MongoDB

**Files to create:**
- `apps/api/src/me/comment.schema.ts` — Mongoose schema mirroring `GithubComment` + `githubId` unique index
- `apps/api/src/me/me.service.ts` — `fetchAndSave(token)`: getAuthenticatedUser → listAccessibleRepos → fetchAllComments (serial) → filter mine → upsert by githubId
- `apps/api/src/me/me.controller.ts` — `POST /me/comments` with `{ token }` body
- `apps/api/src/me/me.module.ts`
- Update `apps/api/src/config.ts` — add `MONGODB_URI` required field
- Update `apps/api/src/app.module.ts` — add `MongooseModule.forRootAsync`

**Acceptance criteria:**
- `POST /me/comments { "token": "<pat>" }` returns `{ saved, total }` counts
- Re-running is idempotent (upsert on githubId)

---

## Task 9 — apps/web: Next.js 15 scaffold

**Files to create:**
- `apps/web/package.json` — `@revi/web`, Next 15, React 19, Tailwind CSS v4
- `apps/web/tsconfig.json` — standalone (module: esnext, moduleResolution: bundler, jsx: preserve)
- `apps/web/next.config.ts` — minimal empty config
- `apps/web/postcss.config.mjs` — `@tailwindcss/postcss` plugin
- `apps/web/src/app/globals.css` — `@import "tailwindcss"`
- `apps/web/src/app/layout.tsx` — root layout
- `apps/web/src/app/page.tsx` — placeholder "Revi — coming soon"

**Acceptance criteria:**
- `yarn workspace @revi/web typecheck` passes (0 errors)
- `yarn workspace @revi/web dev` starts on port 3001

✅ **COMPLETE**

---

## Task 10 — apps/api: generate-skill script

Generate a Claude Code skill JSON from the user's real PR review comments via LLM.

### What it does

1. Reads `apps/api/data.json` (pre-fetched comment corpus)
2. Samples the **N most-recent comments** (default: 200) to stay within context limits
3. Calls the **Anthropic API** (Claude) with a structured prompt asking it to:
   - Identify the reviewer's tone, recurring patterns, and focus areas
   - Produce a Claude Code skill that encodes this style for future PR reviews
4. Writes `apps/api/output/skill.json`:
   ```json
   {
     "name": "string",
     "content": "string (markdown skill body)",
     "tags": ["string"]
   }
   ```

### Dependency graph

```
apps/api/data.json   →   generate-skill.ts   →   Anthropic API   →   output/skill.json
```

### Files to create

| File | Purpose |
|---|---|
| `apps/api/src/scripts/generate-skill.ts` | Main script |
| `apps/api/src/__tests__/generate-skill.test.ts` | Unit tests for pure helpers |

### Key functions (pure — testable without network)

```ts
/** Pick the N comments with the most-recent createdAt, preserving order. */
export function sampleRecentComments(comments: GithubComment[], n: number): GithubComment[]

/** Build the LLM prompt string from a comment sample. */
export function buildPrompt(comments: GithubComment[]): string

/** Parse the LLM response text into a SkillOutput. */
export function parseSkillOutput(text: string): SkillOutput

type SkillOutput = { name: string; content: string; tags: string[] }
```

The `main()` function:
- Reads `ANTHROPIC_API_KEY` from env (exit 1 if missing)
- Reads `data.json` relative to script (default: `apps/api/data.json`)
- Calls `sampleRecentComments(comments, 200)`
- Sends one `messages.create` call (`claude-sonnet-4-6`, `max_tokens: 4096`)
- Calls `parseSkillOutput` on the response
- Writes `apps/api/output/skill.json`

### Prompt design

The system prompt instructs Claude to act as a code review style analyst.
The user message includes:
- Brief preamble (username, total count, sample size)
- Each sampled comment formatted as:
  ```
  [repo: owner/name | type: pr_review_comment | file: path/to/file]
  <body>
  ```
- Instruction to reply with JSON only:
  ```json
  { "name": "...", "content": "...", "tags": [...] }
  ```

The `content` field should be a markdown skill document that describes the reviewer's style
so Claude can emulate it when doing PR reviews.

### New dependency

```
@anthropic-ai/sdk
```

Added to `apps/api/package.json`.

### New script in package.json

```json
"generate-skill": "tsx src/scripts/generate-skill.ts"
```

### Acceptance criteria

1. `sampleRecentComments(comments, 200)` returns exactly 200 items (or all if fewer), sorted newest-first
2. `buildPrompt([])` returns a non-empty string containing the word "review"
3. `parseSkillOutput(validJson)` returns typed `SkillOutput` with name, content, tags
4. `parseSkillOutput(invalidJson)` throws a descriptive error
5. `ANTHROPIC_API_KEY=<key> yarn workspace @revi/api generate-skill` writes `output/skill.json`
6. `yarn workspace @revi/api typecheck` passes with 0 errors

### Verification

```sh
yarn install   # fetches @anthropic-ai/sdk
yarn workspace @revi/api test   # pure helper tests pass
ANTHROPIC_API_KEY=<key> yarn workspace @revi/api generate-skill
cat apps/api/output/skill.json   # valid JSON with name/content/tags
yarn workspace @revi/api typecheck   # 0 errors
```

---

## Hard rules (from CLAUDE.md)

1. No `any`. No `!` without an inline comment explaining why.
2. JSDoc on every exported function and interface.
3. `packages/octokit` has zero NestJS imports.
4. `apps/api` has zero business logic — NestJS wiring only.
5. All `.ts` imports use `.js` extensions (ESM Node resolution).
6. Cross-package imports use package name (`@revi/octokit`), never relative `../../` paths.
7. `yarn typecheck` must pass after every task before moving to the next.
