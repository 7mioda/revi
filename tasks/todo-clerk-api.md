# Task List — Clerk API Authentication

## Phase 1: API auth layer

- [ ] **Task 1** — `apps/api/src/config.ts`: add `CLERK_SECRET_KEY: z.string().optional()`
- [ ] **Task 2** — Create `apps/api/src/auth/`: `public.decorator.ts`, `clerk.guard.ts`, `current-user.decorator.ts`, `auth.module.ts`
- [ ] **CHECKPOINT A** — `yarn workspace @revi/api typecheck` passes (0 errors)

---

## Phase 2: Wiring

- [ ] **Task 3** — `apps/api/src/app.module.ts`: import `AuthModule`
- [ ] **Task 4** — `apps/api/src/webhook/webhook.controller.ts`: add `@Public()` decorator

---

## Phase 3: Web app

- [ ] **Task 5** — `apps/web/src/app/api/onboarding/route.ts`: send `Authorization: Bearer <clerkToken>` on all API fetch calls
- [ ] **CHECKPOINT B** — Smoke test: unprotected request → 401; webhook without token → 200; valid token → 200
