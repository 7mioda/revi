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

- [x] **Task 11** — apps/api: multi-skill generation (one call per dimension)

- [x] **Task 12** — apps/api: review-pr CLI script

---

## Phase 5: Scripts as endpoints

- [x] **Task 13** — Add `ANTHROPIC_API_KEY` to `apps/api/src/config.ts` Zod schema
- [x] **Task 14** — Export `MongooseModule` from `MeModule` (`apps/api/src/me/me.module.ts`)
- [x] **Task 15** — SkillsModule: `POST /skills` (skill.schema, service, controller, module, dto)
- [x] **Task 16** — ReviewsModule: `POST /reviews` (service, controller, module, dto)
- [x] **Task 17** — Register `SkillsModule` + `ReviewsModule` in `AppModule`; smoke test passes

---

## Phase 6: Onboarding pipeline (frontend)

- [x] **Task 18** — route.ts: replace `complete_onboarding` with `fetch_comments` + `generate_skills` + `review_pr` tools (all with `execute`); update system prompt; add `API_URL` env; `maxSteps: 20`
- [x] **Task 19** — onboarding-chat.tsx: remove completion screen; add inline tool status chips (running/done) for all three pipeline tools
