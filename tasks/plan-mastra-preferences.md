# Plan: Mastra Agent + Zod Schema for Preferences

## Goal
Replace raw Anthropic SDK + fragile `parsePreferenceOutput`/`extractJson` in `generate-preference.ts` with a Mastra `Agent` that uses a Zod output schema. Mastra's inference pipeline handles structured output validation internally — no manual JSON parsing needed.

## What changes

### Remove from `generate-preference.ts`
- `extractJson()` — Mastra strips markdown fences internally
- `parsePreferenceOutput()` — replaced by Zod schema
- `generatePreference()` / `generateAllPreferences()` — replaced by `generatePreferences(agent, ...)`
- Direct `Anthropic` import

### Add to `generate-preference.ts`
- `PreferenceOutputSchema` (Zod) — single source of truth for output shape
- `PreferenceOutput` — `z.infer<typeof PreferenceOutputSchema>`
- `createPreferenceAgent(apiKey)` — Mastra Agent factory
- `generatePreferences(agent, dimensions, buckets, onResult?)` — typed generation loop

### Update `preferences.service.ts`
- `new Anthropic(...)` → `createPreferenceAgent(apiKey)`
- `generateAllPreferences(anthropic, ...)` → `generatePreferences(agent, ...)`

### Unchanged
- `buildCorpus`, `bucketByTime`, `buildPreferencePrompt`, `PREFERENCE_DIMENSIONS`
- All NestJS files (module, schema, controller, DTO)

## New deps (`apps/api/package.json`)
- `@mastra/core` — Agent + Mastra inference pipeline
- `@ai-sdk/anthropic` — Anthropic provider for Mastra

> ⚠️ `@mastra/core` requires Node >=22.13.0

## Tasks
- [ ] Task 1: Install `@mastra/core` + `@ai-sdk/anthropic`
- [ ] Task 2: Add `PreferenceOutputSchema` (Zod) + `createPreferenceAgent` to script
- [ ] Task 3: Add `generatePreferences`, remove old manual-parsing functions
- [ ] Task 4: Update `preferences.service.ts` to use agent + new function
