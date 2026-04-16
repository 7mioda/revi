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

- [x] **Task 10** — apps/api: generate-skill script (single skill, one LLM call)

- [ ] **Task 11** — apps/api: multi-skill generation (one call per dimension)
  - Add `SkillDimension` type + `SKILL_DIMENSIONS` array (style, technical-patterns, testing)
  - Update `buildPrompt(dimension, comments)` — dimension-specific focused prompts
  - Add `generateAllSkills(client, dimensions, comments)` — serial LLM calls
  - Update `main()` to call `generateAllSkills` and write `SkillOutput[]` to `skill.json`
  - Update tests: new `buildPrompt` signature, `generateAllSkills` with mock Anthropic client
  - Verify: `yarn workspace @revi/api test` all green
  - Verify: script writes `skill.json` as a JSON array with 3 entries (name/content/tags each)
  - Verify: `yarn workspace @revi/api typecheck` passes
