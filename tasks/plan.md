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

## Task 11 — apps/api: multi-skill generation (one call per dimension)

Extend `generate-skill.ts` so it produces an **array** of skill objects — one per dimension — instead of a single object. Each skill has a distinct focus and its own set of tags.

### What changes

**Output format** (`output/skill.json`):
```json
[
  { "name": "review-style",        "content": "...", "tags": ["style", "communication"] },
  { "name": "technical-patterns",  "content": "...", "tags": ["typescript", "architecture"] },
  { "name": "testing-philosophy",  "content": "...", "tags": ["testing", "coverage"] }
]
```

**Skill dimensions** (hardcoded array, easily extensible):

| Dimension key | Focus | Default tags |
|---|---|---|
| `review-style` | Tone, communication, phrasing | `["style", "communication", "code-review"]` |
| `technical-patterns` | Language features, architecture, naming, error handling | `["typescript", "architecture", "patterns"]` |
| `testing-philosophy` | How tests are reviewed/written, coverage expectations | `["testing", "tdd", "coverage"]` |

### Dependency graph

```
data.json → sampleRecentComments → [dimension[0], dimension[1], dimension[2]]
                                        │               │               │
                                   LLM call #1    LLM call #2    LLM call #3 (serial)
                                        └───────────────┴───────────────┘
                                                        ↓
                                               output/skill.json  (SkillOutput[])
```

### API changes

```ts
/** Describes one skill dimension to generate. */
export interface SkillDimension {
  /** Unique key — becomes the skill name if the LLM doesn't override it. */
  key: string
  /** Short description of what this skill should capture. */
  focus: string
  /** Default tags merged into the output entry. */
  tags: string[]
}

/** The full list of dimensions to generate (exported for testing). */
export const SKILL_DIMENSIONS: SkillDimension[]

/** Build a dimension-specific prompt. Replaces the old single buildPrompt. */
export function buildPrompt(dimension: SkillDimension, comments: GithubComment[]): string

/** Parse a single LLM response → SkillOutput (unchanged contract). */
export function parseSkillOutput(text: string): SkillOutput

/** Run all dimensions sequentially; returns one SkillOutput per dimension. */
export async function generateAllSkills(
  client: Anthropic,
  dimensions: SkillDimension[],
  comments: GithubComment[],
): Promise<SkillOutput[]>
```

`sampleRecentComments` and `parseSkillOutput` signatures are **unchanged**.

The old `buildPrompt(comments)` (no dimension arg) is replaced by `buildPrompt(dimension, comments)`.

### main() flow

```
read ANTHROPIC_API_KEY → read data.json → sample 200
→ generateAllSkills (serial, one API call per dimension)
→ write output/skill.json  (SkillOutput[])
```

### Files to modify

| File | Change |
|---|---|
| `apps/api/src/scripts/generate-skill.ts` | Add `SkillDimension`, `SKILL_DIMENSIONS`, update `buildPrompt`, add `generateAllSkills`; update `main()` |
| `apps/api/src/__tests__/generate-skill.test.ts` | Update `buildPrompt` tests (now takes dimension arg); add tests for `generateAllSkills` shape; update `parseSkillOutput` tests (unchanged) |

### Acceptance criteria

1. `SKILL_DIMENSIONS` is an exported array with at least 3 entries, each with `key`, `focus`, `tags`
2. `buildPrompt(dimension, comments)` — prompt body contains the dimension's `focus` text
3. `buildPrompt(dimension, [])` — still returns a non-empty string containing "review"
4. `parseSkillOutput` tests still pass (no signature change)
5. `sampleRecentComments` tests still pass (no change)
6. `generateAllSkills` with a mock Anthropic client that returns valid JSON → returns array of length equal to `dimensions.length`
7. `ANTHROPIC_API_KEY=<key> yarn workspace @revi/api generate-skill` writes `output/skill.json` as a JSON **array**
8. `yarn workspace @revi/api typecheck` passes with 0 errors

### Verification

```sh
yarn workspace @revi/api test       # all tests green (including updated ones)
yarn workspace @revi/api typecheck  # 0 errors
ANTHROPIC_API_KEY=<key> yarn workspace @revi/api generate-skill
cat apps/api/output/skill.json      # JSON array with 3 objects, each has name/content/tags
```

---

## Task 12 — apps/api: review-pr CLI script

One-shot script that reads the generated skills, fetches a PR from GitHub, runs an LLM review using the skills as the system prompt, and posts the review back to GitHub in a single batch call.

### CLI usage

```sh
GITHUB_TOKEN=<pat> ANTHROPIC_API_KEY=<key> \
  yarn workspace @revi/api review-pr <owner>/<repo> <pull_number>
```

### Dependency graph

```
output/skill.json
      │ loadSkills()
      ▼
system prompt ──────────────────────────────────────────────────┐
                                                                 │
GITHUB_TOKEN → fetchPRMeta()   ─┐                               │
GITHUB_TOKEN → fetchPRFiles()  ─┤─ buildUserPrompt() ──────────►│ Anthropic API
GITHUB_TOKEN → fetchPRComments()┘                               │
                                                                 │
                                                  parseReviewResult()
                                                                 │
                                             mapToGithubReview() │
                                                                 ▼
                                        POST /pulls/{n}/reviews (GitHub)
```

### Files to create

| File | Purpose |
|---|---|
| `apps/api/src/scripts/review-pr.ts` | Main script |
| `apps/api/src/__tests__/review-pr.test.ts` | Unit tests for pure helpers |

### Types

```ts
export interface ReviewComment {
  path: string
  line: number
  side: 'LEFT' | 'RIGHT'
  body: string
}

export interface ReviewResult {
  summary: string
  verdict: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'
  comments: ReviewComment[]
}

export interface GithubReviewPayload {
  body: string
  event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'
  comments: Array<{ path: string; line: number; side: 'LEFT' | 'RIGHT'; body: string }>
}
```

### Pure helpers (exported — tested without network)

```ts
/** Read output/skill.json and return the concatenated `content` fields as a single system prompt. */
export function loadSkills(skillJsonPath: string): string

/** Format PR metadata, file diffs, and existing comments into the LLM user message. */
export function buildUserPrompt(
  meta: { title: string; body: string | null; user: string; base: string; head: string },
  files: Array<{ filename: string; status: string; patch?: string }>,
  existingComments: Array<{ path: string; line: number; body: string }>,
): string

/** Parse the LLM response text → ReviewResult. Throws descriptively on invalid input. */
export function parseReviewResult(text: string): ReviewResult

/** Map a ReviewResult to the GitHub Reviews API payload shape. */
export function mapToGithubReview(result: ReviewResult): GithubReviewPayload
```

### Network functions (`main()` only — not unit tested)

| Function | GitHub endpoint |
|---|---|
| `fetchPRMeta(client, owner, repo, pull)` | `GET /repos/{owner}/{repo}/pulls/{pull}` |
| `fetchPRFiles(client, owner, repo, pull)` | `GET /repos/{owner}/{repo}/pulls/{pull}/files` |
| `fetchExistingComments(client, owner, repo, pull)` | `GET /repos/{owner}/{repo}/pulls/{pull}/comments` |
| `postReview(client, owner, repo, pull, payload)` | `POST /repos/{owner}/{repo}/pulls/{pull}/reviews` |

All four use the `OctokitClient` from `@revi/octokit` (already has throttling + retry).

### `main()` flow

```
parse argv[2] (owner/repo) + argv[3] (pull_number)
→ read GITHUB_TOKEN + ANTHROPIC_API_KEY from env (exit 1 if missing)
→ loadSkills("output/skill.json")  → system prompt
→ fetchPRMeta + fetchPRFiles + fetchExistingComments (parallel via Promise.all)
→ buildUserPrompt(meta, files, comments)
→ Anthropic messages.create({ system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] })
→ parseReviewResult(responseText)
→ mapToGithubReview(result)
→ postReview(client, owner, repo, pull, payload)
→ print confirmation to stderr
```

### User prompt shape (sent to LLM)

```
## PR: <title>
**Author:** <user>  **Branch:** <base> ← <head>

### Description
<body or "(no description)">

### Files changed (<n> files)

#### src/foo.ts (modified)
\`\`\`diff
<patch>
\`\`\`

### Existing review comments (<n>)
- src/foo.ts:42 — "existing comment body"

---
Reply with ONLY a JSON object (no markdown fences):
{
  "summary": "...",
  "verdict": "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
  "comments": [{ "path": "...", "line": <number>, "side": "RIGHT", "body": "..." }]
}
```

### New package.json script

```json
"review-pr": "tsx src/scripts/review-pr.ts"
```

No new dependencies — uses `@anthropic-ai/sdk` and `@revi/octokit` already installed.

### Acceptance criteria

1. `loadSkills(path)` — reads the JSON array and returns a string containing all `content` fields joined with `\n\n---\n\n`
2. `loadSkills(path)` — throws when file does not exist
3. `buildUserPrompt(meta, files, [])` — returns non-empty string containing the PR title
4. `buildUserPrompt(meta, [], comments)` — still returns non-empty string
5. `parseReviewResult(validJson)` — returns typed `ReviewResult` with `summary`, `verdict`, `comments`
6. `parseReviewResult` — throws on malformed JSON
7. `parseReviewResult` — throws when `verdict` is not one of the three allowed values
8. `parseReviewResult` — throws when `comments` is not an array
9. `mapToGithubReview` — maps `summary → body`, `verdict → event`, `comments` pass through
10. `yarn workspace @revi/api typecheck` passes with 0 errors

### Verification

```sh
yarn workspace @revi/api test          # all tests green
yarn workspace @revi/api typecheck     # 0 errors
GITHUB_TOKEN=<pat> ANTHROPIC_API_KEY=<key> \
  yarn workspace @revi/api review-pr owner/repo 42
# → prints "Review posted" confirmation
```

---

---

## Phase 5 — Expose scripts as API endpoints

### Context

`fetch-my-comments` is already covered by `POST /me/comments`. Two new endpoints are needed:
- `POST /skills` — wraps `generate-skill.ts`
- `POST /reviews` — wraps `review-pr.ts`

Full workflow: `POST /me/comments` → `POST /skills` → `POST /reviews`

---

## Task 13 — Add ANTHROPIC_API_KEY to config

Add `ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required')` to the `envSchema` in `apps/api/src/config.ts`.

**Files to modify:**
- `apps/api/src/config.ts`

**Acceptance criteria:**
- `yarn workspace @revi/api typecheck` passes
- Missing `ANTHROPIC_API_KEY` at startup → Zod error, process exits non-zero

---

## Task 14 — Export MongooseModule from MeModule

Add `exports: [MongooseModule]` to `MeModule` so the `Comment` model injection token is available to importing modules (`SkillsModule` needs it).

**Files to modify:**
- `apps/api/src/me/me.module.ts`

**Acceptance criteria:**
- `yarn workspace @revi/api typecheck` passes, existing tests unchanged

---

## Task 15 — SkillsModule: POST /skills

New NestJS module that generates a skill profile from stored comments.

### Files to create
```
apps/api/src/skills/
  skill.schema.ts            — Mongoose schema: name, content, tags, batchId, generatedAt
  dto/generate-skills.dto.ts — { sampleSize?: number }  (@IsOptional @IsInt @Min(1) @Max(500))
  skills.service.ts          — business logic
  skills.controller.ts       — POST /skills
  skills.module.ts
```

### Service logic
1. Query all `Comment` documents → `BadRequestException('No comments found. Run POST /me/comments first.')` if empty
2. `sampleRecentComments(comments, dto.sampleSize ?? 200)` from `../scripts/generate-skill.js`
3. `generateAllSkills(new Anthropic({ apiKey }), SKILL_DIMENSIONS, sample)` from same file
4. `batchId = crypto.randomUUID()`, `generatedAt = new Date().toISOString()`
5. `skillModel.insertMany(skills.map(s => ({ ...s, batchId, generatedAt })))`
6. Return `{ generated: skills.length, skills }`

### SkillsModule imports
- `MeModule` (provides `InjectModel(Comment.name)` via exported `MongooseModule`)
- `MongooseModule.forFeature([{ name: Skill.name, schema: SkillSchema }])`

### Response 201
```json
{ "generated": 3, "skills": [{ "name": "review-style", "content": "...", "tags": [...] }] }
```

**Error**: `400` if no comments in DB

---

## Task 16 — ReviewsModule: POST /reviews

New NestJS module that runs a PR review using the latest skill batch.

### Files to create
```
apps/api/src/reviews/
  dto/create-review.dto.ts  — { owner, repo, pullNumber, post? }
  reviews.service.ts        — business logic
  reviews.controller.ts     — POST /reviews
  reviews.module.ts
```

### Service logic
1. Load latest skill batch: `skillModel.findOne().sort({ generatedAt: -1 })` → get `batchId` → `skillModel.find({ batchId })` → `BadRequestException('No skills found. Run POST /skills first.')` if empty
2. Build skills string: `skills.map(s => s.content).join('\n\n---\n\n')`
3. Fetch PR: `Promise.all([fetchPRMeta, fetchPRFiles, fetchExistingComments])` — lift private functions from `review-pr.ts` inline into service (they are simple Octokit calls)
4. `buildUserPrompt(meta, files, existingComments, skillsString)` from `../scripts/review-pr.js`
5. Call Anthropic, parse with `parseReviewResult(text)` from same file
6. If `dto.post !== false`: `mapToGithubReview(result)` + post via Octokit
7. Return `{ ...result, posted: dto.post !== false }`

### ReviewsModule imports
- `MongooseModule.forFeature([{ name: Skill.name, schema: SkillSchema }])` only — no MeModule needed

### Request body
```json
{ "owner": "acme", "repo": "backend", "pullNumber": 42, "post": true }
```

### Response 201
```json
{ "summary": "...", "verdict": "APPROVE", "comments": [...], "posted": true }
```

**Errors**: `400` no skills; `404` bad PR (HttpExceptionFilter); `400` ValidationPipe

---

## Task 17 — Register new modules in AppModule

Add `SkillsModule` and `ReviewsModule` imports to `apps/api/src/app.module.ts`.

**Acceptance criteria:**
- `yarn workspace @revi/api typecheck` passes
- `yarn workspace @revi/api start` boots with all four routes registered
- Full smoke test passes (see Verification below)

---

### Dependency graph (Phase 5)

```
13 (config)  ──────────────────────────────────────────┐
14 (MeModule export)  ─────────────────────────────┐   │
                                                   │   │
                                               ┌───▼───▼──────────────────┐
                                               │  15 (SkillsModule)        │
                                               └──────────────┬────────────┘
                                                              │
13 (config)  ──────────────────────────────────────────┐     │
                                               ┌───────▼─────▼────────────┐
                                               │  16 (ReviewsModule)       │
                                               └──────────────┬────────────┘
                                                              │
                                                  ┌───────────▼────────────┐
                                                  │  17 (AppModule wiring)  │
                                                  └────────────────────────┘
```

Tasks 13, 14 are independent. Task 15 depends on 13+14. Task 16 depends on 13+15. Task 17 depends on 15+16.

---

### Verification (Phase 5)

```sh
# Typecheck
yarn workspace @revi/api typecheck   # 0 errors

# Existing tests
yarn workspace @revi/api test        # all pass

# Smoke test
GITHUB_TOKEN=<pat> ANTHROPIC_API_KEY=<key> MONGODB_URI=<uri> yarn workspace @revi/api start

curl -X POST http://localhost:3000/me/comments \
  -H 'Content-Type: application/json' -d '{"token":"ghp_..."}'
# → { "user": "...", "saved": N, "breakdown": {...} }

curl -X POST http://localhost:3000/skills \
  -H 'Content-Type: application/json' -d '{}'
# → { "generated": 3, "skills": [...] }

curl -X POST http://localhost:3000/reviews \
  -H 'Content-Type: application/json' \
  -d '{"owner":"acme","repo":"backend","pullNumber":42,"post":false}'
# → { "summary":"...", "verdict":"...", "comments":[...], "posted":false }

# Error paths
curl -X POST http://localhost:3000/reviews \
  -H 'Content-Type: application/json' \
  -d '{"owner":"acme","repo":"backend","pullNumber":-1}'
# → 400 ValidationPipe
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
