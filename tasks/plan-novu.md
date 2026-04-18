# Plan — Novu Notification Package

## Context

Profile sync jobs run as fire-and-forget background tasks.
`ProfilesService.runPipeline()` already calls `this.jobsService.markDone(jobId)`
on success and `this.jobsService.markFailed(jobId, msg)` on failure.
Neither path currently notifies the requesting user.

The goal is to add a thin `@revi/novu` workspace package that wraps `@novu/api`,
expose a typed `NovuService` injectable, wire it into `ProfilesModule`, and call
it immediately after `markDone` / `markFailed`.

---

## Assumptions

1. Novu Cloud (hosted) is used. No self-hosted deployment needed initially.
2. Each GitHub username maps 1-to-1 to a Novu `subscriberId` (the username is
   the subscriber ID). The subscriber is upserted on first trigger via Novu's
   `to` field — no separate subscriber-create call required.
3. Two workflow IDs will be defined in the Novu dashboard:
   - `profile-sync-done`
   - `profile-sync-failed`
   Each workflow is configured in the Novu dashboard (email / in-app channel) and
   is outside the scope of this code change.
4. `zod` is already a dependency of `@revi/api`, so the `@novu/api` peer
   requirement for `zod@^3` is already satisfied in the API app.
5. Notifications are best-effort: a Novu failure must be caught and logged — it
   must never re-throw into the pipeline.
6. `NOVU_API_KEY` is required at startup (hard-fail via Zod).

---

## Package structure: `packages/novu/`

```
packages/novu/
  package.json
  tsconfig.json
  src/
    client.ts      ← createNovuClient(apiKey) → Novu instance
    notify.ts      ← sendNotification(client, subscriberId, event, payload) → Promise<{ ok }>
    types.ts       ← NotificationEvent, NotificationPayload types
    index.ts       ← re-exports
```

### `packages/novu/package.json`

```json
{
  "name": "@revi/novu",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc"
  },
  "dependencies": {
    "@novu/api": "^2.6.0"
  },
  "devDependencies": {
    "typescript": "^6.0.2"
  }
}
```

### `packages/novu/tsconfig.json`

Identical structure to `packages/octokit/tsconfig.json`.

---

## Public API exported by `@revi/novu`

### `types.ts`

```ts
/** Novu workflow identifiers used by this app. */
export type NotificationEvent = 'profile-sync-done' | 'profile-sync-failed'

/** Payload sent with every notification trigger. */
export interface NotificationPayload {
  /** MongoDB ObjectId string of the sync job. */
  jobId: string
  /** GitHub username that was synced. */
  username: string
  /** Human-readable outcome message. */
  message: string
}
```

### `client.ts`

```ts
import { Novu } from '@novu/api'

export function createNovuClient(secretKey: string): Novu {
  return new Novu({ secretKey })
}
```

### `notify.ts`

```ts
import type { Novu } from '@novu/api'
import type { NotificationEvent, NotificationPayload } from './types.js'

/**
 * Fires a Novu notification trigger.
 * Never throws — errors are returned as { ok: false, error }.
 */
export async function sendNotification(
  client: Novu,
  subscriberId: string,
  event: NotificationEvent,
  payload: NotificationPayload,
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  try {
    await client.trigger({
      workflowId: event,
      to: { subscriberId },
      payload: payload as Record<string, unknown>,
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err }
  }
}
```

### `index.ts`

```ts
export { createNovuClient } from './client.js'
export { sendNotification } from './notify.js'
export type { NotificationEvent, NotificationPayload } from './types.js'
```

---

## NestJS wiring in `apps/api/`

### New `NovuService` — injectable wrapper

**File:** `apps/api/src/novu/novu.service.ts`

```ts
@Injectable()
export class NovuService {
  private readonly client: Novu
  private readonly logger = new Logger(NovuService.name)

  constructor(@Inject(ConfigService) private readonly config: ConfigService<Env, true>) {
    this.client = createNovuClient(this.config.get('NOVU_API_KEY'))
  }

  async notifyProfileSyncDone(username: string, jobId: string): Promise<void> {
    const result = await sendNotification(
      this.client, username, 'profile-sync-done',
      { jobId, username, message: `Profile sync completed for ${username}` },
    )
    if (!result.ok) this.logger.error(`Novu trigger failed (profile-sync-done): ${String(result.error)}`)
  }

  async notifyProfileSyncFailed(username: string, jobId: string, errorMsg: string): Promise<void> {
    const result = await sendNotification(
      this.client, username, 'profile-sync-failed',
      { jobId, username, message: errorMsg },
    )
    if (!result.ok) this.logger.error(`Novu trigger failed (profile-sync-failed): ${String(result.error)}`)
  }
}
```

**File:** `apps/api/src/novu/novu.module.ts`

```ts
@Module({ providers: [NovuService], exports: [NovuService] })
export class NovuModule {}
```

---

## Env vars

Add to `apps/api/src/config.ts` `envSchema`:

```ts
NOVU_API_KEY: z.string().min(1, 'NOVU_API_KEY is required'),
```

---

## Changes to `ProfilesModule` and `ProfilesService`

### `profiles.module.ts`
- Import and add `NovuModule` to `imports`.
- Add `NovuService` to `providers`.

### `profiles.service.ts`
- Inject `NovuService` via constructor.
- After `await this.jobsService.markDone(jobId)`:
  `void this.novuService.notifyProfileSyncDone(username, jobId)`
- After `await this.jobsService.markFailed(jobId, msg)`:
  `void this.novuService.notifyProfileSyncFailed(username, jobId, msg)`

Both calls are fire-and-forget (`void`) with errors absorbed inside `NovuService`.

---

## Dependency graph

```
Task 1 — packages/novu/ scaffold
  └── Task 2 — @revi/novu source (types, client, notify, index)
        └── CHECKPOINT A: yarn workspace @revi/novu typecheck
              └── Task 3 — apps/api/package.json: add @revi/novu dep
                    └── Task 4 — config.ts: add NOVU_API_KEY
                          └── Task 5 — apps/api/src/novu/ module + service
                                └── CHECKPOINT B: yarn workspace @revi/api typecheck
                                      └── Task 6 — Wire NovuModule into ProfilesModule
                                            └── CHECKPOINT C: smoke test
```

---

## Tasks

### Task 1 — Scaffold `packages/novu/`
Create `packages/novu/package.json` and `packages/novu/tsconfig.json`.

**Acceptance criteria:**
- `yarn workspaces list` shows `@revi/novu`.
- `@novu/api` listed as a dependency.

### Task 2 — Implement `@revi/novu` source
Create `src/types.ts`, `src/client.ts`, `src/notify.ts`, `src/index.ts`.

**Acceptance criteria:**
- `NotificationEvent` covers both workflow IDs.
- `sendNotification` never throws.
- All imports use `.js` extensions.

### CHECKPOINT A
`yarn workspace @revi/novu typecheck` — 0 errors.

### Task 3 — Add `@revi/novu` to `apps/api/package.json`
Add `"@revi/novu": "workspace:*"` to dependencies.

### Task 4 — Add `NOVU_API_KEY` to `config.ts`
`NOVU_API_KEY: z.string().min(1, 'NOVU_API_KEY is required')`

### Task 5 — `NovuModule` + `NovuService`
Create `apps/api/src/novu/novu.module.ts` and `novu.service.ts`.

**Acceptance criteria:**
- Constructor reads `NOVU_API_KEY` from `ConfigService`.
- Both notify methods absorb errors internally.

### CHECKPOINT B
`yarn workspace @revi/api typecheck` — 0 errors.

### Task 6 — Wire into `ProfilesModule` / `ProfilesService`
Import `NovuModule`, inject `NovuService`, add fire-and-forget calls after `markDone` and `markFailed`.

### CHECKPOINT C — Smoke test
```sh
curl -X POST http://localhost:3000/profiles/octocat/sync
curl http://localhost:3000/profiles/jobs/<jobId>
# → { status: "done" }
# Novu dashboard → activity feed → "profile-sync-done" for subscriber "octocat"
```

---

## Hard rules
1. No `any`. No unexplained non-null assertions.
2. JSDoc on every exported function and interface.
3. All `.ts` imports use `.js` extensions.
4. `sendNotification` never throws.
5. `NovuService` methods never throw.
6. Typechecks pass after every task.
