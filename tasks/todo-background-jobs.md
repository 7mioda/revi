# Task List — Background Job with Step Progress

## Phase 1: Job schema + service

- [ ] **Task 1** — `job.schema.ts`: `ActivityJob` Mongoose schema (status, steps[], timestamps)
- [ ] **Task 2** — `JobsService`: create / markRunning / updateStep / markDone / markFailed / findById
- [ ] **CHECKPOINT A** — `yarn workspace @revi/api typecheck` + `test` clean

---

## Phase 2: Execution + API

- [ ] **Task 3** — Refactor `UsersService`: replace `fetchAndSave` with `run(jobId, username, token?)` that writes step progress via `JobsService`
- [ ] **Task 4** — Update `UsersController`: POST returns `202 { jobId }`; add `GET /users/jobs/:jobId`
- [ ] **Task 5** — Wire `ActivityJob` schema + `JobsService` into `UsersModule`
- [ ] **CHECKPOINT B** — Smoke test: POST → jobId, GET /jobs/:id shows step progress
