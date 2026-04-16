# Task List — pr-style-cloner

## Phase 1: Monorepo infrastructure

- [x] **Task 1** — Monorepo infrastructure
- [x] **Task 2** — packages/octokit: scaffold, types, client factory
- [x] **Task 3** — packages/octokit: fetch functions
- [x] **CHECKPOINT A** — `yarn workspace @revi/octokit typecheck` = 0 errors

---

## Phase 2: @revi/api

- [x] **Task 4** — apps/api: scaffold + bootstrap + ConfigModule
- [x] **Task 5** — apps/api: GithubModule + GET /github/:username/repos
- [x] **Task 6** — apps/api: POST /github/:username/comments
- [x] **CHECKPOINT B** — full end-to-end
- [x] **Task 7** — apps/api: fetch-my-comments CLI script
- [x] **Task 8** — apps/api: POST /me/comments → MongoDB

---

## Phase 3: apps/web

- [x] **Task 9** — apps/web: Next.js 15 scaffold with Tailwind CSS v4

---

## Phase 4: Skill generation

- [ ] **Task 10** — apps/api: generate-skill script
  - Install `@anthropic-ai/sdk`
  - Add `"generate-skill": "tsx src/scripts/generate-skill.ts"` to scripts
  - Create pure helpers: `sampleRecentComments`, `buildPrompt`, `parseSkillOutput`
  - Write failing tests for all three helpers (RED)
  - Implement helpers (GREEN)
  - Implement `main()`: read data.json → sample → LLM call → write output/skill.json
  - Verify: `yarn workspace @revi/api test` passes
  - Verify: `ANTHROPIC_API_KEY=<key> yarn workspace @revi/api generate-skill` writes skill.json
  - Verify: `yarn workspace @revi/api typecheck` passes
