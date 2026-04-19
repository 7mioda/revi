# GitHub App — Task List

New files go into `apps/api/src/github/`. Existing files touched minimally.

## Phase 1: Config + Schema

- [ ] **Task 1 — Config + Schemas + Module wiring**
  - [ ] Extend `apps/api/src/config.ts` with 9 new Zod fields
  - [ ] Install deps: `@octokit/app @octokit/oauth-app @octokit/webhooks @octokit/webhooks-types cookie-parser @types/cookie-parser`
  - [ ] `src/github/schemas/installation.schema.ts`
  - [ ] `src/github/schemas/github-user.schema.ts`
  - [ ] `src/github/schemas/webhook-event.schema.ts` (unique index on deliveryId)
  - [ ] `src/github/github.module.ts` — add MongooseModule.forFeature, stub GithubAppController + GithubAppService
  - [ ] Verify: `yarn workspace @revi/api typecheck` → 0 errors; app boots

---

## Phase 2: Core Utilities

- [ ] **Task 2 — Crypto + State** ← CHECKPOINT A
  - [ ] `src/github/crypto.ts` (encryptToken, decryptToken — AES-256-GCM, node:crypto only)
  - [ ] `src/github/state.ts` (generateState, signState, verifyState — timing-safe HMAC)
  - [ ] `src/__tests__/github-app-crypto.test.ts`
    - [ ] Crypto round-trip
    - [ ] Tampered ciphertext throws
    - [ ] Wrong key throws
    - [ ] State sign→verify round-trip
    - [ ] Tampered state/sig throws
    - [ ] Wrong key throws
  - [ ] Verify: `yarn workspace @revi/api test src/__tests__/github-app-crypto.test.ts` → all pass

---

## Phase 3: Service Layer

- [ ] **Task 3 — GithubAppService: auth helpers**
  - [ ] `src/github/github-app.service.ts`
    - [ ] `getAppOctokit()` — memoized App instance
    - [ ] `getInstallationOctokit(installationId)` — Map cache, 5-min buffer
    - [ ] `exchangeCode(code)` — OAuth code exchange
    - [ ] `getUserOctokit(githubUserId)` — load, auto-refresh if expiring, persist
    - [ ] `persistUserTokens(githubUserId, login, tokens, installationId?)`
    - [ ] `verifyWebhookSignature(rawBody, signature)` — timing-safe vs GITHUB_APP_WEBHOOK_SECRET
  - [ ] Private key: GITHUB_APP_PRIVATE_KEY first, fallback to GITHUB_APP_PRIVATE_KEY_PATH
  - [ ] Verify: `typecheck` → 0 errors; no `any`

- [ ] **Task 4 — GithubAppService: installation + webhook methods**
  - [ ] `upsertInstallation(installationId, accountLogin, accountType, rawJson)`
  - [ ] `removeInstallation(installationId)`
  - [ ] `listInstallations()` → SafeInstallation[] (no rawJson)
  - [ ] `recordWebhookEvent(deliveryId, event, action, installationId, payload): Promise<boolean>` — false on duplicate (E11000)
  - [ ] Verify: `typecheck` → 0 errors; `recordWebhookEvent` false on duplicate

---

## Phase 4: Routes

- [ ] **Task 5 — Webhook route + handlers** ← CHECKPOINT B (full suite after)
  - [ ] Check `main.ts` for `rawBody: true` — add if missing
  - [ ] `src/github/github-app.controller.ts` — `POST /webhooks/github`
    - [ ] `@Public()`
    - [ ] verifyWebhookSignature → 403 on mismatch
    - [ ] recordWebhookEvent → 200 immediately; skip dispatch on duplicate
    - [ ] Fire-and-forget dispatch
  - [ ] Private handlers in GithubAppService (with `// TODO:` markers):
    - [ ] handleInstallationCreated → upsertInstallation
    - [ ] handleInstallationDeleted → removeInstallation
    - [ ] handleInstallationRepositoriesAdded → log + TODO
    - [ ] handleInstallationRepositoriesRemoved → log + TODO
    - [ ] handleIssueCommentCreated → log + TODO
    - [ ] handleIssuesOpened → log + TODO
    - [ ] handlePullRequestOpened → log + TODO
    - [ ] handlePRReviewCommentCreated → log + TODO
  - [ ] `src/__tests__/github-app-webhooks.test.ts`
    - [ ] Valid signature → 200
    - [ ] Tampered body → 403
    - [ ] Duplicate deliveryId → 200, handler not re-invoked
  - [ ] Verify: `yarn workspace @revi/api test src/__tests__/github-app-webhooks.test.ts` → all pass

- [ ] **Task 6 — Auth routes**
  - [ ] Check `main.ts` for `cookie-parser` — add if missing
  - [ ] Add to `GithubAppController`:
    - [ ] `GET /auth/github/install` (`@Public()`) — sign state, httpOnly cookie, redirect
    - [ ] `GET /auth/github` (`@Public()`) — verify state, dispatch 3 cases:
      - [ ] Case 1: installation_id only → upsertInstallation
      - [ ] Case 2: code only → exchangeCode + persistUserTokens
      - [ ] Case 3: both → parallel, link user↔installation
      - [ ] State mismatch → 400
  - [ ] `src/__tests__/github-app-auth.test.ts`
    - [ ] Case 1, 2, 3 via supertest
    - [ ] State mismatch → 400
    - [ ] Missing state → 400
  - [ ] Verify: `yarn workspace @revi/api test src/__tests__/github-app-auth.test.ts` → all pass

- [ ] **Task 7 — Internal API routes** ← CHECKPOINT C (typecheck + test clean)
  - [ ] `src/github/dto/post-comment.dto.ts`
  - [ ] Add to `GithubAppController`:
    - [ ] `GET /api/installations`
    - [ ] `POST /api/comments` (validate body; as: "user" without userId → 400)
    - [ ] `GET /api/users/:userId/notifications`
    - [ ] `// TODO: Add API authentication`
  - [ ] Verify: `typecheck` → 0 errors; GET /api/installations → []; POST missing userId → 400

---

## Checkpoints

| | After | Command |
|---|---|---|
| A | Task 2 | `yarn workspace @revi/api test src/__tests__/github-app-crypto.test.ts` |
| B | Task 5 | `yarn workspace @revi/api test` |
| C | Task 7 | `yarn workspace @revi/api typecheck && yarn workspace @revi/api test` |
