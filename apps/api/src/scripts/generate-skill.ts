/**
 * generate-skill.ts
 *
 * One-shot script: reads `apps/api/data.json` (pre-fetched comment corpus),
 * samples the N most-recent comments, then runs one Anthropic API call per
 * skill dimension to build a JSON array of skill objects.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=<key> yarn workspace @revi/api generate-skill
 *
 * Output: `apps/api/output/skill.json`  — a SkillOutput[] array
 */

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { Anthropic } from '@anthropic-ai/sdk'
import type { GithubComment } from '@revi/octokit'
import type { MyCommentsOutput } from './fetch-my-comments.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single generated skill entry written to `output/skill.json`. */
export interface SkillOutput {
  name: string
  content: string
  tags: string[]
}

/**
 * Describes one dimension of skill to extract from the comment corpus.
 * Each dimension produces one LLM call and one entry in the output array.
 */
export interface SkillDimension {
  /** Unique kebab-case key — used as a fallback name if the LLM omits one. */
  key: string
  /** Short description of what this skill should capture, injected into the prompt. */
  focus: string
  /** Default tags that will appear on this skill entry. */
  tags: string[]
}

// ---------------------------------------------------------------------------
// Skill dimensions — extend this array to add more skills
// ---------------------------------------------------------------------------

/** The ordered list of skill dimensions to generate (one LLM call each). */
export const SKILL_DIMENSIONS: SkillDimension[] = [
  {
    key: 'review-style',
    focus:
      'communication tone, phrasing of feedback, how suggestions vs. hard requirements are expressed, and any signature phrases or habits',
    tags: ['style', 'communication', 'code-review'],
  },
  {
    key: 'technical-patterns',
    focus:
      'preferred language features, naming conventions, architectural patterns, error handling strategies, and any technology-specific preferences',
    tags: ['typescript', 'architecture', 'patterns'],
  },
  {
    key: 'testing-philosophy',
    focus:
      'how tests are reviewed, expectations around test coverage and structure, opinions on mocking vs. integration tests, and test naming habits',
    tags: ['testing', 'tdd', 'coverage'],
  },
  {
    key: 'security-mindset',
    focus:
      'how security concerns are surfaced — input validation, authentication/authorisation checks, injection risks, secret handling, OWASP issues, and how urgently security fixes are demanded vs. suggested',
    tags: ['security', 'auth', 'validation'],
  },
  {
    key: 'performance-awareness',
    focus:
      'how performance issues are identified and communicated — N+1 queries, unnecessary re-renders, algorithmic complexity, caching opportunities, and whether micro-optimisations are encouraged or discouraged',
    tags: ['performance', 'optimization', 'complexity'],
  },
  {
    key: 'code-readability',
    focus:
      'opinions on naming clarity, cognitive complexity, function/class size, self-documenting code vs. comments, and how strongly readability is weighted against brevity or cleverness',
    tags: ['readability', 'naming', 'complexity'],
  },
  {
    key: 'error-handling',
    focus:
      'expectations around error propagation, user-facing error messages, exception vs. result types, logging on errors, and patterns for distinguishing recoverable from unrecoverable failures',
    tags: ['error-handling', 'resilience', 'logging'],
  },
  {
    key: 'api-design',
    focus:
      'preferences for REST/GraphQL/RPC contract design, HTTP status code usage, request/response shape, backwards compatibility, versioning discipline, and how breaking changes are treated',
    tags: ['api', 'rest', 'contracts'],
  },
  {
    key: 'documentation-standards',
    focus:
      'expectations around inline comments, JSDoc/TSDoc, README updates, changelog entries, ADRs, and the balance between over-documentation and under-documentation',
    tags: ['documentation', 'comments', 'jsdoc'],
  },
  {
    key: 'dependency-management',
    focus:
      'attitudes toward adding third-party dependencies, version pinning, licence compliance, bundle-size awareness, and when to roll a solution in-house vs. reach for a library',
    tags: ['dependencies', 'bundle-size', 'third-party'],
  },
  {
    key: 'data-modeling',
    focus:
      'how schema design decisions are reviewed — normalisation, index choices, migration safety, nullable vs. required fields, and concerns about backward-incompatible data changes',
    tags: ['database', 'schema', 'migrations'],
  },
  {
    key: 'async-and-concurrency',
    focus:
      'how async/await patterns, promise chains, race conditions, deadlocks, cancellation, and concurrent state mutations are identified and addressed in reviews',
    tags: ['async', 'concurrency', 'promises'],
  },
  {
    key: 'type-safety',
    focus:
      'strictness expectations around TypeScript — use of `any`, type narrowing, generics, utility types, discriminated unions, and how type-level correctness is weighted in feedback',
    tags: ['typescript', 'types', 'type-safety'],
  },
  {
    key: 'observability-and-logging',
    focus:
      'expectations around structured logging, metric instrumentation, distributed tracing, alert-worthy conditions, and whether log verbosity and cardinality are called out',
    tags: ['observability', 'logging', 'metrics'],
  },
  {
    key: 'refactoring-instincts',
    focus:
      'when the reviewer pushes to extract, simplify, or generalise vs. accepting local duplication — patterns like DRY enforcement, premature abstraction warnings, and YAGNI observations',
    tags: ['refactoring', 'dry', 'abstraction'],
  },
  {
    key: 'review-prioritisation',
    focus:
      'how the reviewer classifies and signals severity — blocking issues vs. nits vs. optional suggestions — and how they sequence or group feedback to guide the author efficiently',
    tags: ['prioritisation', 'blockers', 'nits'],
  },
  {
    key: 'accessibility',
    focus:
      'how accessibility requirements are raised in UI/frontend changes — ARIA attributes, keyboard navigation, colour contrast, screen-reader semantics, and WCAG compliance expectations',
    tags: ['accessibility', 'a11y', 'wcag'],
  },
]

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
 * Builds a dimension-specific LLM prompt from a comment sample.
 * The prompt asks Claude to focus only on the dimension's `focus` area
 * and return a single JSON skill object.
 *
 * @param dimension - The skill dimension that scopes what Claude should analyse.
 * @param comments  - The comment sample to include in the prompt.
 */
export function buildPrompt(dimension: SkillDimension, comments: GithubComment[]): string {
  const formattedComments = comments
    .map((c) => {
      const header = `[repo: ${c.repoOwner}/${c.repoName} | type: ${c.type} | file: ${c.path ?? 'n/a'}]`
      return `${header}\n${c.body}`
    })
    .join('\n\n---\n\n')

  return `You are a code review style analyst. Below are ${comments.length} real pull-request review comments written by a single developer.

Your task is to analyse ONLY the following dimension of their review behaviour:
**${dimension.focus}**

Based on this dimension, produce a Claude Code skill document that encodes this specific aspect of the reviewer's style so an AI assistant can emulate it when doing future PR code reviews.

Respond with **only** a JSON object (no markdown fences, no extra text):
{
  "name": "<kebab-case skill name reflecting this dimension>",
  "content": "<full markdown skill document for this dimension>",
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

/**
 * Runs one LLM call per dimension (serially) and returns all skill outputs.
 *
 * @param client     - Anthropic API client.
 * @param dimensions - Ordered list of dimensions to generate.
 * @param comments   - Pre-sampled comment corpus shared across all dimensions.
 */
export async function generateAllSkills(
  client: Anthropic,
  dimensions: SkillDimension[],
  comments: GithubComment[],
): Promise<SkillOutput[]> {
  const skills: SkillOutput[] = []

  for (const dimension of dimensions) {
    process.stderr.write(`  Generating skill: ${dimension.key}…\n`)
    const prompt = buildPrompt(dimension, comments)

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const responseText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as { type: 'text'; text: string }).text)
      .join('')

    skills.push(parseSkillOutput(responseText))
  }

  return skills
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

  // Resolve data.json relative to the monorepo root (cwd when run via yarn workspace)
  const candidates = [
    path.resolve('data.json'),
    path.resolve('apps/api/data.json'),
    path.resolve(
      path.dirname(new URL(import.meta.url).pathname),
      '../../../../apps/api/data.json',
    ),
  ]
  const dataPath = candidates.find((p) => fs.existsSync(p))
  if (!dataPath) {
    process.stderr.write('Error: data.json not found. Run fetch-my-comments first.\n')
    process.exit(1)
  }

  process.stderr.write(`Reading comments from ${dataPath}…\n`)
  const raw = fs.readFileSync(dataPath, 'utf-8')
  const data = JSON.parse(raw) as MyCommentsOutput

  const SAMPLE_SIZE = 200
  const sample = sampleRecentComments(data.comments, SAMPLE_SIZE)
  process.stderr.write(
    `Sampled ${sample.length} most-recent comments from ${data.totalComments} total.\n`,
  )
  process.stderr.write(`Generating ${SKILL_DIMENSIONS.length} skills…\n`)

  const client = new Anthropic({ apiKey })
  const skills = await generateAllSkills(client, SKILL_DIMENSIONS, sample)

  const outputDir = path.resolve('output')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  const outputPath = path.join(outputDir, 'skill.json')
  fs.writeFileSync(outputPath, JSON.stringify(skills, null, 2))

  const names = skills.map((s) => s.name).join(', ')
  process.stderr.write(`\nDone. ${skills.length} skill(s) [${names}] written to ${outputPath}\n`)
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
