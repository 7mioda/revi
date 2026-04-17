# Plan — Fetch User Activity (Issues, PRs, Comments)

## Context

Extend the existing `@revi/octokit` package and `apps/api` to fetch **issues**,
**pull requests**, and **comments** for any GitHub username. The fetch runs in
clear, sequential steps and stores results progressively after each step.

Public resources are accessible without a token. When a token is provided the
pipeline also covers private repositories.

---

## Assumptions

1. "Issues" = issues *authored* by the user (not just commented on).
2. "Pull requests" = PRs *authored* by the user.
3. "Comments" = existing three types (`pr_review_comment`, `pr_comment`,
   `commit_comment`) — no change to the `GithubComment` type.
4. The GitHub Search API (`/search/issues`) is used for issues and PRs because
   it returns results across *all* repos globally, works without a token for
   public data, and requires no repo-iteration loop.
5. Comments still require iterating repos (Search API doesn't expose comment
   bodies), so `searchReposWithCommenter` is reused.
6. For private-repo comments (token path): `listAccessibleRepos` is called
   additionally; its results are merged with the search-discovered repos to
   ensure private repos are also covered.
7. Progressive storage = upsert to MongoDB immediately after each step
   completes, not at the end of the full pipeline.

---

## Dependency graph

```
packages/octokit (no NestJS)
  └── Task 1: optional token in createOctokitClient
  └── Task 2: GithubIssue + GithubPR types in types.ts
  └── Task 3: fetchUserIssues (search API)
  └── Task 4: fetchUserPullRequests (search API)

apps/api
  └── Task 5: issue.schema.ts + pull-request.schema.ts
  └── Task 6: UserActivityService (4-step pipeline, progressive upsert)
      depends on: Tasks 1–5
  └── Task 7: Wire new schemas + service into UsersModule
      depends on: Tasks 5–6
```

---

## Task 1 — Make token optional in `createOctokitClient`

**File:** `packages/octokit/src/client.ts`

Change signature from `createOctokitClient(token: string)` to
`createOctokitClient(token?: string)`. When `token` is `undefined` the client
omits the `auth` option — GitHub still serves public resources, at the
unauthenticated rate limit (60 req/h).

**Acceptance criteria:**
- `createOctokitClient()` (no arg) compiles and returns a working client.
- `createOctokitClient(token)` behaviour is unchanged.
- `yarn workspace @revi/octokit typecheck` passes.

---

## Task 2 — Add `GithubIssue` and `GithubPullRequest` types

**File:** `packages/octokit/src/types.ts`

```ts
export interface GithubIssue {
  githubId: number        // issue.id
  number: number          // issue.number
  title: string
  body: string | null
  state: 'open' | 'closed'
  authorLogin: string     // issue.user.login
  repoOwner: string       // parsed from repository_url
  repoName: string
  labels: string[]        // label names
  createdAt: string
  updatedAt: string
  closedAt: string | null
}

export interface GithubPullRequest {
  githubId: number
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed' | 'merged'
  authorLogin: string
  repoOwner: string
  repoName: string
  labels: string[]
  draft: boolean
  createdAt: string
  updatedAt: string
  closedAt: string | null
  mergedAt: string | null
}
```

Export both from `index.ts`.

**Acceptance criteria:**
- `yarn workspace @revi/octokit typecheck` passes.
- No `any`, no `!` assertions.

---

## Task 3 — `fetchUserIssues`

**File:** `packages/octokit/src/fetch-user-issues.ts`

```ts
export async function fetchUserIssues(
  client: OctokitClient,
  username: string,
): Promise<GithubIssue[]>
```

Uses `client.paginate(client.rest.search.issuesAndPullRequests, { q: 'author:{username} type:issue', per_page: 100 })`.

Maps `repository_url` → `repoOwner`/`repoName` (same pattern as
`searchReposWithCommenter`). Maps `pull_request` absence to confirm it's an
issue (search `type:issue` filter should be sufficient but is good to double-check).

Export from `index.ts`.

**Acceptance criteria:**
- Function signature matches above.
- Returns `GithubIssue[]` with no raw Octokit types crossing the package boundary.
- `yarn workspace @revi/octokit typecheck` passes.

---

## Task 4 — `fetchUserPullRequests`

**File:** `packages/octokit/src/fetch-user-pull-requests.ts`

```ts
export async function fetchUserPullRequests(
  client: OctokitClient,
  username: string,
): Promise<GithubPullRequest[]>
```

Same query strategy: `q: 'author:{username} type:pr'`. Maps `pull_request.merged_at`
to derive `state: 'merged'` when applicable (otherwise `open` | `closed`).

Export from `index.ts`.

**Acceptance criteria:**
- Same as Task 3 but for PRs.
- `state` is `'merged'` when `pull_request.merged_at` is set, otherwise mirrors
  the raw `state` field.
- `yarn workspace @revi/octokit typecheck` passes.

---

## CHECKPOINT A — `@revi/octokit` complete

```sh
yarn workspace @revi/octokit typecheck   # must be 0 errors
```

Do not proceed to `apps/api` until clean.

---

## Task 5 — Mongoose schemas: Issue + PullRequest

**Files:**
- `apps/api/src/users/issue.schema.ts`
- `apps/api/src/users/pull-request.schema.ts`

Each schema mirrors its type from `@revi/octokit`. Add a unique index on
`githubId` in both schemas to support idempotent upserts.

Example:
```ts
@Schema({ collection: 'issues' })
export class Issue {
  @Prop({ required: true, unique: true }) githubId!: number
  // … all GithubIssue fields
}
```

**Acceptance criteria:**
- No `any`, no `!` without explanation.
- `yarn workspace @revi/api typecheck` passes.

---

## Task 6 — `UserActivityService`: 4-step pipeline

**File:** `apps/api/src/users/users.service.ts` (extend or replace existing)

The service exposes one public method:

```ts
async fetchAndSave(
  username: string,
  token?: string,          // optional — enables private-repo access
): Promise<UserActivityResult>
```

```ts
export interface UserActivityResult {
  issues: number
  pullRequests: number
  comments: number
}
```

### Pipeline steps (sequential, each stores before the next begins)

**Step 1 — Issues (public + private if token)**
```
client = createOctokitClient(token)  // token may be undefined
issues = await fetchUserIssues(client, username)
upsert issues → MongoDB (by githubId)
```

**Step 2 — Pull Requests (public + private if token)**
```
prs = await fetchUserPullRequests(client, username)
upsert prs → MongoDB (by githubId)
```

**Step 3 — Comment repo discovery**
```
publicRepos  = await searchReposWithCommenter(client, username)
privateRepos = token ? await listAccessibleRepos(client) : []
repos        = deduplicated union of publicRepos + privateRepos
```

**Step 4 — Comments (per repo, store after each repo)**
```
for repo of repos:
  try:
    comments = await fetchAllComments(client, repo.owner, repo.name)
    mine     = comments.filter(c => c.username === username)
    upsert mine → MongoDB (by githubId)   ← progressive: saved here, not at end
  catch (non-200): log warning, continue
```

### Why sequential (not parallel)

- Rate limit safety: spreading calls over time avoids hitting the 5,000 req/h
  authenticated (or 60/h unauthenticated) cap.
- Each step's result is stored before the next starts — if the process is
  interrupted after step 2, issues and PRs are already persisted.

**Acceptance criteria:**
- `fetchAndSave(username)` (no token) fetches only public resources.
- `fetchAndSave(username, token)` additionally covers private repos in step 3–4.
- Comments are upserted after *each* repo, not once at the end.
- No new `any` types.
- `yarn workspace @revi/api typecheck` passes.

---

## Task 7 — Wire new schemas and service into `UsersModule`

**File:** `apps/api/src/users/users.module.ts`

1. Add `MongooseModule.forFeature([{ name: Issue.name, schema: IssueSchema }, { name: PullRequest.name, schema: PullRequestSchema }])` to `UsersModule` imports.
2. Inject `InjectModel(Issue.name)` and `InjectModel(PullRequest.name)` into `UsersService`.
3. Update `UsersController.fetchComments` (or add a new `POST /users/:username/activity` handler) to call `fetchAndSave(username, token?)` and return `UserActivityResult`.

**Response shape:**
```json
{
  "user": "octocat",
  "issues": 42,
  "pullRequests": 17,
  "comments": 203
}
```

The `Authorization: Bearer <token>` header (already read by the controller) is
passed through as the optional token.

**Acceptance criteria:**
- `yarn workspace @revi/api typecheck` passes (0 errors).
- `POST /users/:username/activity` without `Authorization` fetches public data.
- `POST /users/:username/activity` with `Authorization: Bearer <pat>` fetches
  private data too.
- Re-running is idempotent (upsert by `githubId`).

---

## CHECKPOINT B — Full smoke test

```sh
yarn workspace @revi/api typecheck   # 0 errors

# Start server
GITHUB_TOKEN=<pat> MONGODB_URI=<uri> ANTHROPIC_API_KEY=<key> \
  WEBHOOK_SECRET=test REVIEW_COMMAND=x yarn workspace @revi/api start

# Public-only fetch (no user token)
curl -X POST http://localhost:3000/users/octocat/activity \
  -H 'Content-Type: application/json'
# → { "user": "octocat", "issues": N, "pullRequests": N, "comments": N }

# Authenticated fetch (includes private repos)
curl -X POST http://localhost:3000/users/octocat/activity \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer ghp_...'
# → same shape, potentially larger counts
```

---

## Hard rules (inherited from project CLAUDE.md)

1. No `any`. No `!` without an inline explanatory comment.
2. JSDoc on every exported function and interface.
3. `packages/octokit` has zero NestJS imports.
4. All `.ts` imports use `.js` extensions (ESM Node resolution).
5. `yarn typecheck` must pass after every task before moving on.
