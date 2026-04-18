# Plan — Clerk Authentication on the API

## Context

The web app (`apps/web`) already uses `@clerk/nextjs` with middleware protecting all routes
except `/sign-in`. The NestJS API (`apps/api`) has zero authentication — all endpoints are
public, and `userId` is passed as an optional body parameter by the web client, not verified.

The goal is to add a NestJS auth layer that:
1. Validates Clerk JWTs sent by the web app in `Authorization: Bearer <token>`
2. Exposes the verified Clerk `userId` to any endpoint via a `@CurrentUser()` decorator
3. Does not break the existing `/webhook/github` route (which has its own HMAC verification)
4. Requires minimal changes to existing controllers

---

## How Clerk auth works on the API side

Clerk issues a short-lived session JWT (the "session token") to authenticated browser clients.
The web app retrieves this token via `await (await auth()).getToken()` and forwards it in the
`Authorization: Bearer <token>` header.

On the API, `@clerk/backend` verifies the JWT against Clerk's public JWKS endpoint using the
`CLERK_SECRET_KEY`. On success it returns a `JWTPayload` containing the Clerk `sub` (= userId).

---

## Key decisions

### Global guard with `@Public()` opt-out (chosen)
Apply `ClerkGuard` globally via `APP_GUARD` so auth is the default.
Routes that must remain unauthenticated (webhook) use a `@Public()` decorator.
This is the most secure posture and matches the pattern used by the web app middleware.

### `@clerk/backend` (not `@clerk/clerk-sdk-node`)
`@clerk/backend` is the current Clerk server-side SDK. It exposes `verifyToken()` and
`createClerkClient()`. `@clerk/clerk-sdk-node` is legacy.

### `CLERK_SECRET_KEY` is optional at startup
Consistent with `NOVU_API_KEY`. If absent the guard logs a warning and passes all requests
through (ClerkGuard is a no-op), preserving the current open behaviour.
Set it to enforce auth.

### `userId` in DTOs is NOT removed
Existing `userId` and `username` params in DTOs still work — they are used by internal tooling
and background jobs that never go through the Clerk flow. The `@CurrentUser()` decorator is an
additive way for controllers to read the verified Clerk userId on top of that.

---

## Architecture

```
Web app                              API
─────────────────────────────────────────────────────────────────────
1. await (await auth()).getToken()   →  Authorization: Bearer <jwt>
                                        ↓
                                     ClerkGuard (global APP_GUARD)
                                       ├─ route @Public()?  → allow
                                       ├─ no header + key unset → allow
                                       ├─ no header + key set  → 401
                                       └─ verifyToken(jwt, key) → req.clerkUserId = sub
                                        ↓
                                     Controller
                                       └─ @CurrentUser() userId: string | null
```

---

## New files

### `apps/api/src/auth/public.decorator.ts`
```ts
export const IS_PUBLIC_KEY = 'isPublic'
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
```

### `apps/api/src/auth/clerk.guard.ts`
NestJS `CanActivate` guard registered as `APP_GUARD`.

```
- reads CLERK_SECRET_KEY from ConfigService
- if key is absent: sets req.clerkUserId = null, returns true (no-op mode)
- if key present and no Authorization header: returns 401
- verifies token via @clerk/backend verifyToken(token, { secretKey })
- on success: sets req.clerkUserId = payload.sub, returns true
- on failure: throws UnauthorizedException
- @Public() routes always pass through before any of the above
```

### `apps/api/src/auth/current-user.decorator.ts`
```ts
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null =>
    ctx.switchToHttp().getRequest<{ clerkUserId: string | null }>().clerkUserId ?? null,
)
```

### `apps/api/src/auth/auth.module.ts`
```ts
@Module({
  providers: [{ provide: APP_GUARD, useClass: ClerkGuard }],
  exports: [],
})
export class AuthModule {}
```

---

## Modified files

| File | Change |
|------|--------|
| `apps/api/src/config.ts` | Add `CLERK_SECRET_KEY: z.string().optional()` |
| `apps/api/src/app.module.ts` | Import `AuthModule` |
| `apps/api/src/webhook/webhook.controller.ts` | Add `@Public()` decorator |
| `apps/web/src/app/api/onboarding/route.ts` | Pass `Authorization: Bearer <token>` header |

---

## Request type augmentation

To type `req.clerkUserId` without `any`, add a declaration merge:

```ts
// apps/api/src/auth/clerk.guard.ts (or a separate express.d.ts)
declare module 'express' {
  interface Request {
    clerkUserId: string | null
  }
}
```

---

## Dependency graph

```
Task 1 — config.ts: add CLERK_SECRET_KEY (optional)
  └── Task 2 — auth/: Public decorator + ClerkGuard + CurrentUser decorator + AuthModule
        └── CHECKPOINT A: yarn workspace @revi/api typecheck passes
              └── Task 3 — app.module.ts: import AuthModule
                    └── Task 4 — webhook.controller.ts: @Public()
                          └── Task 5 — web app: pass Clerk token in API requests
                                └── CHECKPOINT B: smoke test end-to-end
```

---

## Tasks

### Task 1 — `CLERK_SECRET_KEY` in config
Add to `apps/api/src/config.ts` envSchema:
```ts
CLERK_SECRET_KEY: z.string().optional(),
```

**Acceptance criteria:**
- Server starts without `CLERK_SECRET_KEY` (guard runs in no-op mode).
- `yarn workspace @revi/api typecheck` passes.

---

### Task 2 — Auth module: guard + decorators

**`apps/api/src/auth/public.decorator.ts`**
- Exports `Public` decorator and `IS_PUBLIC_KEY` constant.

**`apps/api/src/auth/clerk.guard.ts`**
- Implements `CanActivate`.
- Reads `IS_PUBLIC_KEY` reflector metadata — if true, returns `true` immediately.
- If `CLERK_SECRET_KEY` is not configured: sets `req.clerkUserId = null`, returns `true`.
- Extracts `Authorization` header; if absent when key is set: throws `UnauthorizedException`.
- Calls `verifyToken(token, { secretKey })` from `@clerk/backend`.
- On success: sets `req.clerkUserId = payload.sub`, returns `true`.
- On failure: throws `UnauthorizedException`.

**`apps/api/src/auth/current-user.decorator.ts`**
- `@CurrentUser()` param decorator returning `req.clerkUserId`.

**`apps/api/src/auth/auth.module.ts`**
- Registers `ClerkGuard` as `APP_GUARD`.

**Acceptance criteria:**
- `ClerkGuard` never throws when `CLERK_SECRET_KEY` is absent.
- `@Public()` routes bypass all token logic.
- `@CurrentUser()` returns the `sub` from a valid JWT.

---

### CHECKPOINT A
```sh
yarn workspace @revi/api typecheck   # 0 errors
```

---

### Task 3 — Wire `AuthModule` into `AppModule`

Add `AuthModule` to `imports` in `apps/api/src/app.module.ts`.

**Acceptance criteria:**
- App still starts without `CLERK_SECRET_KEY` (no-op mode).
- All existing endpoints respond normally (no regressions).

---

### Task 4 — Mark webhook as `@Public()`

Add `@Public()` to the `WebhookController` class decorator stack in
`apps/api/src/webhook/webhook.controller.ts`. The webhook endpoint uses
HMAC signature verification — it must never require a Clerk token.

**Acceptance criteria:**
- `POST /webhook/github` with valid HMAC returns 200 without an Authorization header.

---

### Task 5 — Web app: send Clerk session token

In `apps/web/src/app/api/onboarding/route.ts` (and any future API route handlers):

```ts
import { auth } from '@clerk/nextjs/server'

// Inside the handler:
const { getToken, userId } = await auth()
const clerkToken = await getToken()

// Pass to every API fetch:
headers: {
  'Content-Type': 'application/json',
  ...(clerkToken ? { Authorization: `Bearer ${clerkToken}` } : {}),
}
```

**Acceptance criteria:**
- Onboarding API route reads the Clerk session token.
- All fetch calls to `API_URL` include `Authorization: Bearer <token>` when authenticated.
- `yarn workspace @revi/web typecheck` passes.

---

### CHECKPOINT B — Smoke test
```sh
# Start API with CLERK_SECRET_KEY set
CLERK_SECRET_KEY=sk_test_... yarn workspace @revi/api start

# Without token → 401
curl -X POST http://localhost:3000/skills -H 'Content-Type: application/json' -d '{}'
# → 401 Unauthorized

# Webhook still works without token
curl -X POST http://localhost:3000/webhook/github \
  -H 'x-hub-signature-256: sha256=<valid>' \
  -d '{}'
# → processes normally (not 401)

# With valid Clerk token → 200
curl -X POST http://localhost:3000/skills \
  -H 'Authorization: Bearer <clerk-session-token>' \
  -H 'Content-Type: application/json' \
  -d '{"username": "torvalds"}'
```

---

## Hard rules
1. No `any` except where `@clerk/backend` types require it.
2. `ClerkGuard` never throws when `CLERK_SECRET_KEY` is absent — it silently becomes a no-op.
3. `@Public()` is the escape hatch — do not add ad-hoc token skipping inside the guard logic.
4. Do not remove `userId`/`username` params from existing DTOs — they remain for internal use.
5. All typechecks pass after every task.
