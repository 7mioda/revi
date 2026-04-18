# Preferences Feature — Tasks

## Task 1 — Schema
- [ ] Create `apps/api/src/preferences/preference.schema.ts`
  - Fields: `name`, `dimension`, `content`, `tags[]`, `evolution` (string|null, default null), `batchId`, `generatedAt`, `userId` (indexed), `username`
  - Export `Preference`, `PreferenceSchema`, `PreferenceDocument`
- [ ] Verify: `tsc --noEmit` passes

## Task 2 — Script: pure helpers
- [ ] Create `apps/api/src/scripts/generate-preference.ts`
  - Types: `TemporalItem`, `TimeBucket`, `PreferenceDimension`, `PreferenceOutput`
  - `buildCorpus(comments, issues, prs)` — merge + filter empty bodies + sort by createdAt asc
  - `bucketByTime(corpus)` — split into early/mid/recent thirds, cap each at 100 items
  - `buildPreferencePrompt(dimension, buckets)` — prompt with 3 labelled windows + date ranges
  - `parsePreferenceOutput(raw)` — validate JSON, accept `evolution: null`
  - `PREFERENCE_DIMENSIONS` — 5 dimensions (communication-style, problem-framing, code-ownership-attitude, detail-orientation, collaboration-receptivity)
- [ ] Unit tests for all pure helpers

## Task 3 — Script: LLM integration
- [ ] Add `generateAllPreferences(client, dimensions, buckets)` to script
  - Serial loop, one `client.messages.create` per dimension (model: claude-sonnet-4-6, max_tokens: 4096)
- [ ] Verify with mocked Anthropic: returns 5 PreferenceOutput in dimension order

## Task 4 — Module wiring
- [ ] `apps/api/src/users/users.module.ts` — add `exports: [MongooseModule]`
- [ ] Create `apps/api/src/preferences/dto/generate-preferences.dto.ts`
  - `userId?: string`, `username?: string` — at least one required (custom validator)
  - Query differs by collection: comments uses `username`, issues/PRs use `authorLogin`
- [ ] Create `apps/api/src/preferences/preferences.module.ts` (stub service)
- [ ] Create `apps/api/src/preferences/preferences.controller.ts` (stub)
- [ ] `apps/api/src/app.module.ts` — add `PreferencesModule`
- [ ] Verify: `nest build` passes; `POST /preferences` → 501

## Task 5 — Service
- [ ] Implement `apps/api/src/preferences/preferences.service.ts`
  - Inject: Comment, Issue, PullRequest, Preference models + ConfigService
  - `generate(userId?, username?)`: query 3 collections with collection-specific filters → buildCorpus → bucketByTime → generateAllPreferences → insertMany
    - comments: `{ $or: [{ userId }, { username }] }`
    - issues/PRs: `{ $or: [{ userId }, { authorLogin: username }] }`
  - Throw `BadRequestException` if all collections empty
- [ ] Integration test with mocked Anthropic + seeded data

## Task 6 — Controller
- [ ] Implement `preferences.controller.ts` — `POST /preferences` → 201
- [ ] Verify: DTO validation rejects invalid types → 400

## Checkpoint: End-to-end
- [ ] Fetch activity: `POST /users/:username/activity` → poll until done
- [ ] `POST /preferences { userId, username }` → `{ generated: 5, preferences: [...] }`
- [ ] MongoDB: 5 docs, unique dimensions, non-empty content, evolution is string|null
