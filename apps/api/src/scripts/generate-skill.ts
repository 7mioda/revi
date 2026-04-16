/**
 * generate-skill.ts
 *
 * One-shot script: reads `apps/api/data.json` (pre-fetched comment corpus),
 * samples the N most-recent comments, calls the Anthropic API to analyse the
 * reviewer's style, and writes the result to `apps/api/output/skill.json`.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=<key> yarn workspace @revi/api generate-skill
 */

import fs from 'fs'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import type { GithubComment } from '@revi/octokit'
import type { MyCommentsOutput } from './fetch-my-comments.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The shape written to `output/skill.json`. */
export interface SkillOutput {
  name: string
  content: string
  tags: string[]
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit testing)
// ---------------------------------------------------------------------------

/**
 * Returns the N most-recent comments (by `createdAt`), sorted newest-first.
 * Does not mutate the input array.
 */
export function sampleRecentComments(comments: GithubComment[], n: number): GithubComment[] {
  return [...comments]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, n)
}

/**
 * Formats a comment sample into an LLM prompt string.
 * The prompt asks Claude to analyse the reviewer's style and return a skill JSON.
 */
export function buildPrompt(comments: GithubComment[]): string {
  const formattedComments = comments
    .map((c) => {
      const header = `[repo: ${c.repoOwner}/${c.repoName} | type: ${c.type} | file: ${c.path ?? 'n/a'}]`
      return `${header}\n${c.body}`
    })
    .join('\n\n---\n\n')

  return `You are a code review style analyst. Below are ${comments.length} real pull-request review comments written by a single developer.

Analyse the comments and identify:
- Tone and communication style (e.g. direct, constructive, questioning)
- Recurring technical patterns the reviewer focuses on (e.g. naming, error handling, test coverage)
- How the reviewer phrases suggestions vs. hard requirements
- Any signature phrases or habits

Then produce a Claude Code skill that encodes this style so an AI can emulate it when doing future PR reviews.

Respond with **only** a JSON object (no markdown fences, no extra text):
{
  "name": "<kebab-case skill name>",
  "content": "<full markdown skill document describing the review style>",
  "tags": ["<tag1>", "<tag2>"]
}

---

REVIEW COMMENTS:

${formattedComments}`
}

/**
 * Parses the raw LLM response text into a typed `SkillOutput`.
 * Throws a descriptive error if the JSON is malformed or fields are missing.
 */
export function parseSkillOutput(text: string): SkillOutput {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`LLM response is not valid JSON: ${text.slice(0, 200)}`)
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('LLM response JSON is not an object')
  }

  const obj = parsed as Record<string, unknown>

  if (typeof obj['name'] !== 'string' || obj['name'].length === 0) {
    throw new Error('LLM response is missing a valid "name" string field')
  }
  if (typeof obj['content'] !== 'string' || obj['content'].length === 0) {
    throw new Error('LLM response is missing a valid "content" string field')
  }
  if (!Array.isArray(obj['tags'])) {
    throw new Error('LLM response is missing a valid "tags" array field')
  }

  return {
    name: obj['name'],
    content: obj['content'],
    tags: obj['tags'] as string[],
  }
}

// ---------------------------------------------------------------------------
// Script entrypoint — only runs when executed directly, not when imported
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey || apiKey.length === 0) {
    process.stderr.write('Error: ANTHROPIC_API_KEY environment variable is required but not set.\n')
    process.exit(1)
  }

  // Resolve data.json relative to the monorepo root (two levels up from apps/api/src/scripts/)
  const dataPath = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '../../../../apps/api/data.json',
  )
  const resolvedData = fs.existsSync(dataPath)
    ? dataPath
    : path.resolve('data.json')

  if (!fs.existsSync(resolvedData)) {
    process.stderr.write(`Error: data.json not found. Run fetch-my-comments first.\n`)
    process.exit(1)
  }

  process.stderr.write(`Reading comments from ${resolvedData}…\n`)
  const raw = fs.readFileSync(resolvedData, 'utf-8')
  const data = JSON.parse(raw) as MyCommentsOutput

  const SAMPLE_SIZE = 200
  const sample = sampleRecentComments(data.comments, SAMPLE_SIZE)
  process.stderr.write(
    `Sampled ${sample.length} most-recent comments from ${data.totalComments} total.\n`,
  )

  const prompt = buildPrompt(sample)

  process.stderr.write('Calling Anthropic API…\n')
  const client = new Anthropic({ apiKey })
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const responseText = message.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('')

  const skill = parseSkillOutput(responseText)

  const outputDir = path.resolve('output')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  const outputPath = path.join(outputDir, 'skill.json')
  fs.writeFileSync(outputPath, JSON.stringify(skill, null, 2))

  process.stderr.write(`\nDone. Skill "${skill.name}" written to ${outputPath}\n`)
}

// Run only when this file is the entrypoint, not when imported by tests.
const scriptUrl = new URL(import.meta.url)
const entryUrl = new URL(`file://${path.resolve(process.argv[1] ?? '')}`)
if (scriptUrl.href === entryUrl.href) {
  main().catch((err: unknown) => {
    process.stderr.write(`Error: ${String(err)}\n`)
    process.exit(1)
  })
}
