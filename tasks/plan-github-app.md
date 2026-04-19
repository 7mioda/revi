# GitHub App — Plan

## Placement

All new code goes into the existing `apps/api/src/github/` module. New files are added alongside the existing ones; existing files are extended minimally.

**Existing files (touch only as needed):**
- `github.module.ts` — extend to add MongooseModule schemas + new providers
- `github.controller.ts` — leave as-is
- `github.service.ts` — leave as-is

**New files:**
```
apps/api/src/github/
  github-app.controller.ts   # /auth/github/*, /webhooks/github, /api/*
  github-app.service.ts      # GitHub App business logic
  crypto.ts                  # AES-256-GCM
  state.ts                   # OAuth state HMAC
  schemas/
    installation.schema.ts
    github-user.schema.ts
    webhook-event.schema.ts
  dto/
    post-comment.dto.ts
```

---

## Config Changes

Extend `apps/api/src/config.ts` Zod schema with:

```
GITHUB_APP_ID              (required)
GITHUB_APP_CLIENT_ID       (required)
GITHUB_APP_CLIENT_SECRET   (required)
GITHUB_APP_PRIVATE_KEY     (required — PEM, \n-escaped; or use GITHUB_APP_PRIVATE_KEY_PATH)
GITHUB_APP_PRIVATE_KEY_PATH (optional — file path alternative)
GITHUB_APP_WEBHOOK_SECRET  (required — separate from existing WEBHOOK_SECRET)
GITHUB_APP_SLUG            (required — for install redirect URL)
PUBLIC_URL                 (required — https://talk.withrevi.dev)
TOKEN_ENCRYPTION_KEY       (required — 32 bytes base64)
```

---

## MongoDB Schemas

### `installation.schema.ts`
```
installationId: number  (unique index)
accountLogin: string
accountType: 'User' | 'Organization'
createdAt: Date
rawJson: Record<string, unknown>
```

### `github-user.schema.ts`
```
githubUserId: number  (unique index)
login: string
accessTokenEncrypted: string
refreshTokenEncrypted: string
accessTokenExpiresAt: Date
refreshTokenExpiresAt: Date
installationId: number
```

### `webhook-event.schema.ts`
```
deliveryId: string  (unique index — idempotency key)
event: string
action: string
installationId: number
receivedAt: Date
payloadJson: Record<string, unknown>
```

---

## Routes

All in `GithubAppController`. Auth handled per-route:

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/auth/github/install` | `@Public()` | Redirect to GitHub App install URL |
| `GET` | `/auth/github` | `@Public()` | OAuth callback (3 cases) |
| `POST` | `/webhooks/github` | `@Public()` | Webhook ingestion |
| `GET` | `/api/installations` | Clerk (default) | List installations |
| `POST` | `/api/comments` | Clerk (default) | Post comment as app or user |
| `GET` | `/api/users/:userId/notifications` | Clerk (default) | Read user notifications |

---

## Task Slices

### Task 1 — Config + Schemas + Module wiring

**Goal**: New env vars validated at startup; 3 schemas registered; app still boots.

**Changes:**
- `src/config.ts` — add 9 new fields to `envSchema`
- `src/github/schemas/installation.schema.ts`
- `src/github/schemas/github-user.schema.ts`
- `src/github/schemas/webhook-event.schema.ts`
- `src/github/github.module.ts` — add `MongooseModule.forFeature([...3 schemas...])` to imports; add `GithubAppController` + `GithubAppService` as stubs

**Acceptance criteria:**
- `yarn workspace @revi/api typecheck` → 0 errors
- Missing new env var → startup Zod error
- App boots with stubs in place

---

### Task 2 — Crypto + State utilities

**Goal**: AES-256-GCM token encryption and HMAC-SHA256 OAuth state helpers. Unit tests.

**Files:**
- `src/github/crypto.ts`
  - `encryptToken(plaintext, keyBase64): string` → `"iv:authTag:ciphertext"` (hex)
  - `decryptToken(encrypted, keyBase64): string`
  - 12-byte IV, 16-byte auth tag, `node:crypto` only

- `src/github/state.ts`
  - `generateState(): string` — 16 random bytes, URL-safe base64
  - `signState(state, key): string` → `"state.HMAC-hex"`
  - `verifyState(signed, key): string` — timing-safe, throws on mismatch
  - HMAC key derived from `TOKEN_ENCRYPTION_KEY` with fixed context string

- `src/__tests__/github-app-crypto.test.ts`
  - Crypto: round-trip, tampered ciphertext throws, wrong key throws
  - State: sign→verify round-trip, tampered throws, wrong key throws

**Acceptance criteria:**
- `yarn workspace @revi/api test src/__tests__/github-app-crypto.test.ts` → all pass
- No env vars or network needed

**CHECKPOINT A**: Crypto + state independently testable.

---

### Task 3 — GithubAppService: auth helpers

**Goal**: Octokit wiring, installation token cache, user token refresh.

**File:** `src/github/github-app.service.ts`

Methods:
- `getAppOctokit(): App` — `@octokit/app` App from config; memoized singleton
- `getInstallationOctokit(installationId: number): Promise<Octokit>` — in-process `Map` cache, 5-min expiry buffer
- `exchangeCode(code: string): Promise<UserTokens>` — via `@octokit/oauth-app`
- `getUserOctokit(githubUserId: number): Promise<Octokit>` — load from DB, refresh if expiring, persist updated tokens
- `persistUserTokens(githubUserId, login, tokens, installationId?): Promise<void>` — encrypt + upsert
- `verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): void` — timing-safe HMAC vs `GITHUB_APP_WEBHOOK_SECRET`

Private key loading: `GITHUB_APP_PRIVATE_KEY` first, fallback to `GITHUB_APP_PRIVATE_KEY_PATH` (readFileSync).

**Acceptance criteria:**
- `typecheck` → 0 errors
- `getInstallationOctokit` second call within 5 min hits cache (no network)
- No `any`

---

### Task 4 — GithubAppService: installation + webhook repo methods

**Goal**: CRUD for installations and idempotent webhook event recording.

**Add to `GithubAppService`:**
- `upsertInstallation(installationId, accountLogin, accountType, rawJson): Promise<void>`
- `removeInstallation(installationId: number): Promise<void>`
- `listInstallations(): Promise<SafeInstallation[]>` — excludes `rawJson`
- `recordWebhookEvent(deliveryId, event, action, installationId, payload): Promise<boolean>` — returns `false` if duplicate (catch MongoDB E11000 on unique `deliveryId` index)

**Acceptance criteria:**
- `typecheck` → 0 errors
- `recordWebhookEvent` returns `false` on duplicate `deliveryId`

---

### Task 5 — Webhook route + handlers

**Goal**: `POST /webhooks/github` — verify, deduplicate, dispatch.

**Files:**
- `src/github/github-app.controller.ts` (partial — webhook route only)
  - `@Public()`, reads raw body + headers
  - Calls `verifyWebhookSignature` → 403 on mismatch
  - Calls `recordWebhookEvent` → 200 immediately; skip dispatch if duplicate
  - Fire-and-forget dispatch to private handler

- Private handlers in `GithubAppService` (with `// TODO:` markers):
  - `handleInstallationCreated` → `upsertInstallation`
  - `handleInstallationDeleted` → `removeInstallation`
  - `handleInstallationRepositoriesAdded/Removed` → log + TODO
  - `handleIssueCommentCreated`, `handleIssuesOpened`, `handlePullRequestOpened`, `handlePRReviewCommentCreated` → log + TODO

- Check `main.ts` for `rawBody: true` — add if missing

- `src/__tests__/github-app-webhooks.test.ts`
  - Valid signature → 200
  - Tampered body → 403
  - Duplicate `deliveryId` → 200, handler not re-invoked

**Acceptance criteria:**
- `yarn workspace @revi/api test src/__tests__/github-app-webhooks.test.ts` → all pass

**CHECKPOINT B**: Full `yarn workspace @revi/api test` green.

---

### Task 6 — Auth routes

**Goal**: Install redirect and 3-case OAuth callback.

**Add to `GithubAppController`:**
- `GET /auth/github/install` — `@Public()`, sign state, set httpOnly cookie (10-min, sameSite=lax), redirect to GitHub install URL
- `GET /auth/github` — `@Public()`, verify state cookie, dispatch:
  1. `installation_id` only → `upsertInstallation` (fetch details via App Octokit)
  2. `code` only → `exchangeCode` + `persistUserTokens`
  3. Both → parallel, link user ↔ installation
  - State mismatch → 400

Check `main.ts` for `cookie-parser` — add if missing.

**File:** `src/__tests__/github-app-auth.test.ts`
- All 3 dispatch cases (mock service methods via NestJS testing module + supertest)
- State mismatch → 400
- Missing state → 400

**Acceptance criteria:**
- `yarn workspace @revi/api test src/__tests__/github-app-auth.test.ts` → all pass

---

### Task 7 — Internal API routes

**Goal**: 3 internal endpoints.

**Add to `GithubAppController`:**
- `GET /api/installations` → `listInstallations()`
- `POST /api/comments` — validate body (`{ installationId, owner, repo, issueNumber, body, as: "app"|"user", userId? }`); `as: "user"` without `userId` → 400; post via appropriate Octokit; return `{ commentId, url }`
- `GET /api/users/:userId/notifications` → `getUserOctokit(userId)`, call GitHub notifications API

Add `// TODO: Add API authentication` above these routes.

**File:** `src/github/dto/post-comment.dto.ts`

**Acceptance criteria:**
- `typecheck` → 0 errors
- `GET /api/installations` → `[]`
- `POST /api/comments` with `as: "user"`, no `userId` → 400

**CHECKPOINT C**: `typecheck` + `test` both clean.

---

## Risks

1. **Raw body**: The existing `WebhookController` uses `req.rawBody` — check if `rawBody: true` is already in `main.ts`. If yes, the new route gets it for free.
2. **`WEBHOOK_SECRET` vs `GITHUB_APP_WEBHOOK_SECRET`**: Must be separate secrets for separate apps/integrations.
3. **Octokit token expiry field**: Verify field name (`expires_at`) in current `@octokit/app` version before implementing 5-min cache.
4. **Cookie parser**: Check `main.ts` — add `cookieParser()` middleware if not already registered.
5. **`TOKEN_ENCRYPTION_KEY` dual use**: Same key for AES-256-GCM and HMAC state. Known shortcut — comment in code.
6. **Internal API auth**: Clerk auth applies by default (no `@Public()`). Caller must provide a valid Clerk token. If web app makes server-to-server calls, decide on auth strategy before shipping.
