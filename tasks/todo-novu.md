# Task List — Novu Notification Package

## Phase 1: `packages/novu/` package

- [ ] **Task 1** — Scaffold `packages/novu/`: `package.json` + `tsconfig.json`
- [ ] **Task 2** — Implement `src/types.ts`, `src/client.ts`, `src/notify.ts`, `src/index.ts`
- [ ] **CHECKPOINT A** — `yarn workspace @revi/novu typecheck` passes (0 errors)

---

## Phase 2: API app integration

- [ ] **Task 3** — Add `"@revi/novu": "workspace:*"` to `apps/api/package.json`
- [ ] **Task 4** — `apps/api/src/config.ts`: add `NOVU_API_KEY` to `envSchema`
- [ ] **Task 5** — Create `apps/api/src/novu/novu.module.ts` + `novu.service.ts`
- [ ] **CHECKPOINT B** — `yarn workspace @revi/api typecheck` passes (0 errors)

---

## Phase 3: Trigger point wiring

- [ ] **Task 6** — Wire `NovuModule` into `ProfilesModule`; inject `NovuService` into `ProfilesService`; add `notifyProfileSyncDone` after `markDone`; add `notifyProfileSyncFailed` after `markFailed`
- [ ] **CHECKPOINT C** — Smoke test: POST sync → poll to done → verify Novu activity feed shows `profile-sync-done` for the subscriber
