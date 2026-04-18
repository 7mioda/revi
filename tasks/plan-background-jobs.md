# Plan — Background Job with Step Progress for fetchActivity

## Context

`POST /users/:username/activity` currently blocks the HTTP connection while
running 4 sequential GitHub API steps that can take 30–120 seconds for active
users. The request either times out in production or forces the client to wait.

The fix: the endpoint immediately returns a `jobId`, the 4-step pipeline runs
asynchronously in the background, and the client polls
`GET /users/jobs/:jobId` to follow progress step-by-step.

---

## Assumptions

1. **No Redis** — job state lives in MongoDB. No new infrastructure to deploy.
2. **Fire-and-forget** — `void usersService.run(jobId, ...)` after returning the
   HTTP 202. Works correctly for a single NestJS instance (the common case here).
3. **Steps are the existing 4** — `issues`, `pullRequests`, `repos`, `comments`.
   Each step tracks `status` and `count` independently.
4. The old synchronous `fetchAndSave` method is removed and replaced by the
   async job runner. The service public API changes from returning a result
   to taking a `jobId` and writing progress as it goes.
5. The `token` provided at job creation is stored encrypted-at-rest concern is
   out of scope; for now it is kept only in memory and not persisted.

---

## Job document shape

```ts
{
  _id: ObjectId,       // also the jobId returned to the client
  username: string,
  status: 'pending' | 'running' | 'done' | 'failed',
  steps: [
    { name: 'issues',       status: 'pending'|'running'|'done'|'failed', count: 0 },
    { name: 'pullRequests', status: 'pending'|'running'|'done'|'failed', count: 0 },
    { name: 'repos',        status: 'pending'|'running'|'done'|'failed', count: 0 },
    { name: 'comments',     status: 'pending'|'running'|'done'|'failed', count: 0 },
  ],
  createdAt: string,      // ISO 8601
  startedAt: string|null,
  completedAt: string|null,
  error: string|null,
}
```

---

## API contract

| Method | Path | Body/Header | Response |
|--------|------|-------------|----------|
| `POST` | `/users/:username/activity` | `Authorization: Bearer <token>` (opt.) | `202 { jobId }` |
| `GET`  | `/users/jobs/:jobId`        | — | `200 <job doc>` or `404` |

---

## Dependency graph

```
Task 1 — job.schema.ts (Job Mongoose schema)
  └── Task 2 — JobsService (create, markRunning, updateStep, markDone, markFailed)
        ├── Task 3 — Refactor UsersService → run(jobId, username, token?)
        │             updates each step via JobsService as pipeline progresses
        ├── Task 4 — Update UsersController
        │             POST returns 202 { jobId }; GET /jobs/:jobId added
        └── Task 5 — Wire Job schema + JobsService into UsersModule
```

Tasks 3 and 4 are independent of each other; both depend on Task 2.
Task 5 depends on all prior tasks.

---

## Task 1 — `job.schema.ts`

**File:** `apps/api/src/users/job.schema.ts`

```ts
type StepName = 'issues' | 'pullRequests' | 'repos' | 'comments'
type StepStatus = 'pending' | 'running' | 'done' | 'failed'
type JobStatus  = 'pending' | 'running' | 'done' | 'failed'

@Schema({ collection: 'activity_jobs', timestamps: false })
class ActivityJob {
  @Prop({ type: String, required: true, index: true }) username: string
  @Prop({ type: String, required: true, enum: ['pending','running','done','failed'] }) status: JobStatus
  @Prop([{ name: String, status: String, count: Number }]) steps: Step[]
  @Prop({ type: String, required: true }) createdAt: string
  @Prop({ type: String, default: null }) startedAt: string | null
  @Prop({ type: String, default: null }) completedAt: string | null
  @Prop({ type: String, default: null }) error: string | null
}
```

Export: `ActivityJob`, `ActivityJobDocument`, `ActivityJobSchema`.

**Acceptance criteria:**
- Schema compiles.
- `steps` array always initialised with all 4 steps in `pending` status.
- `yarn workspace @revi/api typecheck` passes.

---

## Task 2 — `JobsService`

**File:** `apps/api/src/users/jobs.service.ts`

```ts
@Injectable()
class JobsService {
  /** Creates a new job in `pending` state. Returns the saved document. */
  async create(username: string): Promise<ActivityJob & { _id: Types.ObjectId }>

  /** Marks the job as running and records startedAt. */
  async markRunning(jobId: string): Promise<void>

  /** Updates a single step: sets its status and, when done, its count. */
  async updateStep(jobId: string, name: StepName, status: StepStatus, count?: number): Promise<void>

  /** Marks the job done and records completedAt. */
  async markDone(jobId: string): Promise<void>

  /** Marks the job failed and records the error message. */
  async markFailed(jobId: string, error: string): Promise<void>

  /** Fetches a job by ID. Returns null if not found. */
  async findById(jobId: string): Promise<ActivityJob | null>
}
```

**Acceptance criteria:**
- `create()` initialises all 4 steps with `status: 'pending'`, `count: 0`.
- `updateStep()` only touches the matching step (array filter update).
- `markDone()` / `markFailed()` set the correct top-level `status` and timestamp.
- `yarn workspace @revi/api typecheck` passes.

---

## CHECKPOINT A

```sh
yarn workspace @revi/api typecheck   # 0 errors
yarn workspace @revi/api test        # no new failures vs baseline
```

---

## Task 3 — Refactor `UsersService`

Replace `fetchAndSave(username, token?)` with `run(jobId, username, token?)`.

The method no longer returns a value. It updates the job document at the start
of each step (`running`) and on completion (`done` + count). On any
unrecoverable error it calls `markFailed` and returns.

**Step update pattern (same for all 4 steps):**

```
markRunning(jobId)

// Step 1 — issues
updateStep(jobId, 'issues', 'running')
issues = fetchUserIssues(...)
upsertIssues(...)
updateStep(jobId, 'issues', 'done', issues.length)

// Step 2 — pullRequests
updateStep(jobId, 'pullRequests', 'running')
for each PR: fetchPRDiff → upsert
updateStep(jobId, 'pullRequests', 'done', prs.length)

// Step 3 — repos
updateStep(jobId, 'repos', 'running')
repos = searchReposWithCommenter + listAccessibleRepos
updateStep(jobId, 'repos', 'done', repos.length)

// Step 4 — comments
updateStep(jobId, 'comments', 'running')
for each repo: fetchAllComments → filter → upsert
updateStep(jobId, 'comments', 'done', commentCount)

markDone(jobId)
```

`UsersService` now takes `JobsService` as a constructor dependency.

**Acceptance criteria:**
- `run()` calls `updateStep` with `'running'` before each step starts.
- `run()` calls `updateStep` with `'done'` and correct count after each step.
- On any thrown error at the job level: `markFailed` is called.
- Per-repo / per-PR errors are still swallowed and logged (no job failure).
- `fetchAndSave` is deleted.
- `yarn workspace @revi/api typecheck` passes.

---

## Task 4 — Update `UsersController`

**Changes:**

1. `POST /users/:username/activity`
   - Creates job via `JobsService.create(username)`
   - Fires `void this.usersService.run(job._id.toString(), username, token)`
   - Returns `HttpCode(202)` `{ jobId: job._id.toString() }`

2. New handler: `GET /users/jobs/:jobId`
   - Calls `JobsService.findById(jobId)`
   - Returns the job document or throws `NotFoundException`

**Acceptance criteria:**
- `POST` responds immediately with `202` and a `jobId` string.
- `GET /users/jobs/:jobId` returns the full job document.
- `GET /users/jobs/nonexistent` returns 404.
- `yarn workspace @revi/api typecheck` passes.

---

## Task 5 — Wire into `UsersModule`

**File:** `apps/api/src/users/users.module.ts`

- Add `MongooseModule.forFeature([{ name: ActivityJob.name, schema: ActivityJobSchema }])`
- Add `JobsService` to `providers`.
- `UsersService` constructor now injects `JobsService`.

**Acceptance criteria:**
- `yarn workspace @revi/api typecheck` passes (0 errors).
- `yarn workspace @revi/api test` — no new failures beyond pre-existing 2.

---

## CHECKPOINT B — Smoke test

```sh
# Start server
GITHUB_TOKEN=<pat> MONGODB_URI=<uri> ANTHROPIC_API_KEY=<key> \
  WEBHOOK_SECRET=test REVIEW_COMMAND=x yarn workspace @revi/api start

# Kick off a job
curl -X POST http://localhost:3000/users/octocat/activity
# → 202 { "jobId": "..." }

# Poll progress
curl http://localhost:3000/users/jobs/<jobId>
# → { status: "running", steps: [{ name:"issues", status:"done", count:N }, ...] }

# After completion
curl http://localhost:3000/users/jobs/<jobId>
# → { status: "done", completedAt: "...", steps: [all done] }
```

---

## Hard rules (inherited)

1. No `any`. No `!` without explanatory comment.
2. JSDoc on every exported function and interface.
3. All `.ts` imports use `.js` extensions.
4. `yarn typecheck` passes after every task.
