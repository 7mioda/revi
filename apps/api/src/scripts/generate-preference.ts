/**
 * generate-preference.ts
 *
 * Analyses a developer's GitHub activity (comments, issues, PR descriptions)
 * across three time windows (early / mid / recent) to build a behavioural
 * preference profile — how they code, think, and communicate.
 *
 * Uses a Mastra Agent with a Zod output schema so structured output is
 * validated automatically — no manual JSON parsing needed.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=<key> yarn workspace @revi/api generate-preference
 *
 * Output: `apps/api/output/preference.json` — a PreferenceOutput[] array
 */

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import { Agent } from '@mastra/core/agent'
import { createAnthropic } from '@ai-sdk/anthropic'
import type { GithubComment } from '@revi/octokit'

// ---------------------------------------------------------------------------
// Output schema — single source of truth for structured LLM output
// ---------------------------------------------------------------------------

export const PreferenceOutputSchema = z.object({
  name: z.string().min(1),
  dimension: z.string().min(1),
  content: z.string().min(1),
  tags: z.array(z.string()),
  evolution: z.string().nullable(),
})

export type PreferenceOutput = z.infer<typeof PreferenceOutputSchema>

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single item in the unified corpus, regardless of source. */
export interface TemporalItem {
  source: 'comment' | 'issue' | 'pr'
  body: string
  title?: string
  repoOwner?: string
  repoName?: string
  createdAt: string
}

/** One of three chronological windows of the corpus. */
export interface TimeBucket {
  label: 'early' | 'mid' | 'recent'
  items: TemporalItem[]
  from: string
  to: string
}

/** Describes one dimension of preference to extract. */
export interface PreferenceDimension {
  /** Unique kebab-case key. */
  key: string
  /** What the LLM should focus on for this dimension. */
  focus: string
  /** Default tags. */
  tags: string[]
}

// ---------------------------------------------------------------------------
// Preference dimensions — 5 focused behavioural dimensions
// ---------------------------------------------------------------------------

export const PREFERENCE_DIMENSIONS: PreferenceDimension[] = [
  {
    key: 'communication-style',
    focus:
      'tone (formal vs. casual), verbosity, directness, use of questions vs. directives, how criticism or requests are framed, and any recurring phrases or sentence patterns across comments and issue descriptions',
    tags: ['communication', 'tone', 'writing'],
  },
  {
    key: 'problem-framing',
    focus:
      'how the developer describes problems — whether they start with context or jump to solutions, how they decompose issues, whether they use narrative prose vs. bullet lists vs. task checklists, and whether issues/PRs include reproduction steps, acceptance criteria, or expected outcomes',
    tags: ['problem-solving', 'structure', 'issues'],
  },
  {
    key: 'code-ownership-attitude',
    focus:
      'how protective or open the developer is about existing code — resistance or openness to refactors, how they respond to architectural deviations, whether PRs mention backward compatibility or migration notes, and how strongly they enforce consistency with existing patterns',
    tags: ['ownership', 'refactoring', 'collaboration'],
  },
  {
    key: 'detail-orientation',
    focus:
      'whether the developer tends toward exhaustive specificity or high-level summaries — do they quote exact variable names and line numbers, include environment details in issues, enumerate every changed file in PRs, and how often they request clarification vs. infer intent',
    tags: ['detail', 'precision', 'thoroughness'],
  },
  {
    key: 'collaboration-receptivity',
    focus:
      'how the developer engages with others — encouraging language alongside corrections, acknowledging prior discussion, offering to pair or elaborate, pre-empting reviewer concerns in PRs, and whether they tend to resolve discussions unilaterally or wait for consensus',
    tags: ['collaboration', 'feedback', 'social'],
  },
]

// Max items shown per bucket in any single prompt — keeps token usage predictable.
const MAX_ITEMS_PER_BUCKET = 100

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit testing)
// ---------------------------------------------------------------------------

/** Lightweight shapes accepted by buildCorpus from Mongoose lean results. */
export interface RawComment {
  body: string
  username?: string
  repoOwner?: string
  repoName?: string
  createdAt: string
}

export interface RawIssue {
  title: string
  body?: string | null
  repoOwner?: string
  repoName?: string
  createdAt: string
}

export interface RawPullRequest {
  title: string
  body?: string | null
  repoOwner?: string
  repoName?: string
  createdAt: string
}

/**
 * Merges comments, issues, and PRs into a single corpus sorted ascending by
 * createdAt. Items with no usable text content are filtered out.
 */
export function buildCorpus(
  comments: RawComment[],
  issues: RawIssue[],
  prs: RawPullRequest[],
): TemporalItem[] {
  const items: TemporalItem[] = []

  for (const c of comments) {
    if (c.body.trim().length > 0) {
      items.push({ source: 'comment', body: c.body, repoOwner: c.repoOwner, repoName: c.repoName, createdAt: c.createdAt })
    }
  }

  for (const i of issues) {
    const body = i.body?.trim() ?? ''
    const text = body.length > 0 ? body : i.title
    if (text.length > 0) {
      items.push({ source: 'issue', body: text, title: i.title, repoOwner: i.repoOwner, repoName: i.repoName, createdAt: i.createdAt })
    }
  }

  for (const p of prs) {
    const body = p.body?.trim() ?? ''
    const text = body.length > 0 ? body : p.title
    if (text.length > 0) {
      items.push({ source: 'pr', body: text, title: p.title, repoOwner: p.repoOwner, repoName: p.repoName, createdAt: p.createdAt })
    }
  }

  return items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

/**
 * Splits a chronologically sorted corpus into three equal-ish time windows:
 * early (oldest third), mid (middle third), recent (newest third).
 *
 * If total items < 3, everything goes into `recent`.
 */
export function bucketByTime(corpus: TemporalItem[]): TimeBucket[] {
  const n = corpus.length

  const earlyEnd = Math.floor(n / 3)
  const midEnd = Math.floor((n * 2) / 3)

  const slices: { label: TimeBucket['label']; items: TemporalItem[] }[] = [
    { label: 'early', items: n >= 3 ? corpus.slice(0, earlyEnd) : [] },
    { label: 'mid', items: n >= 3 ? corpus.slice(earlyEnd, midEnd) : [] },
    { label: 'recent', items: n >= 3 ? corpus.slice(midEnd) : corpus },
  ]

  return slices.map(({ label, items }) => {
    const capped = items.slice(-MAX_ITEMS_PER_BUCKET)
    return {
      label,
      items: capped,
      from: capped[0]?.createdAt ?? '',
      to: capped[capped.length - 1]?.createdAt ?? '',
    }
  })
}

/** Formats a single TemporalItem for inclusion in an LLM prompt. */
function formatItem(item: TemporalItem): string {
  const repo = item.repoOwner && item.repoName ? `${item.repoOwner}/${item.repoName}` : 'unknown'
  const header = `[source: ${item.source} | repo: ${repo}]`
  const body = item.title && item.title !== item.body ? `${item.title}\n${item.body}` : item.body
  return `${header}\n${body}`
}

/** Formats a bucket section for inclusion in an LLM prompt. */
function formatBucket(bucket: TimeBucket): string {
  const range = bucket.from && bucket.to ? ` (${bucket.from.slice(0, 10)} → ${bucket.to.slice(0, 10)})` : ''
  const header = `${bucket.label.toUpperCase()} WINDOW — ${bucket.items.length} items${range}:`
  if (bucket.items.length === 0) return `${header}\n(no data in this window)`
  return `${header}\n\n${bucket.items.map(formatItem).join('\n\n---\n\n')}`
}

/**
 * Builds a dimension-specific LLM prompt that includes all three time windows
 * so the model can describe temporal evolution alongside current preferences.
 */
export function buildPreferencePrompt(dimension: PreferenceDimension, buckets: TimeBucket[]): string {
  const totalItems = buckets.reduce((sum, b) => sum + b.items.length, 0)
  const windowSections = buckets.map(formatBucket).join('\n\n' + '='.repeat(60) + '\n\n')

  return `You are a developer behaviour analyst. Below is a chronological corpus of ${totalItems} GitHub activity items from a single developer, split into three time windows: EARLY, MID, and RECENT.

Analyse ONLY the following dimension of their behaviour:
**${dimension.focus}**

For each window, note what you observe. Then produce a single preference document that encodes this dimension so an AI assistant can emulate it when acting on this developer's behalf.

Also write a one-sentence "evolution" field summarising how this preference changed (or stayed constant) across the three windows. Set it to null if there is too little data to determine any pattern.

${'='.repeat(60)}

${windowSections}`
}

// ---------------------------------------------------------------------------
// Mastra Agent factory
// ---------------------------------------------------------------------------

/**
 * Creates a Mastra Agent configured with the Anthropic Claude model and
 * instructions for developer behaviour analysis.
 */
export function createPreferenceAgent(apiKey: string): Agent {
  return new Agent({
    id: 'preference-analyst',
    name: 'preference-analyst',
    instructions:
      'You are a developer behaviour analyst. Analyse the GitHub activity provided and produce a structured preference document for the requested dimension.',
    model: createAnthropic({ apiKey })('claude-sonnet-4-6'),
  })
}

// ---------------------------------------------------------------------------
// Generation loop
// ---------------------------------------------------------------------------

/**
 * Runs one Agent call per dimension (serially). The Mastra Agent uses the
 * PreferenceOutputSchema Zod schema for structured output — no manual JSON
 * parsing needed. Calls `onResult` after each successful generation so
 * callers can persist immediately without waiting for the full batch.
 */
export async function generatePreferences(
  agent: Agent,
  dimensions: PreferenceDimension[],
  buckets: TimeBucket[],
  onResult?: (preference: PreferenceOutput) => Promise<void>,
): Promise<PreferenceOutput[]> {
  const results: PreferenceOutput[] = []

  for (const dimension of dimensions) {
    process.stderr.write(`  Generating preference: ${dimension.key}…\n`)
    const prompt = buildPreferencePrompt(dimension, buckets)

    const { object } = await agent.generate(prompt, {
      structuredOutput: { schema: PreferenceOutputSchema },
    })

    results.push(object)
    await onResult?.(object)
  }

  return results
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

  const candidates = [
    path.resolve('data.json'),
    path.resolve('apps/api/data.json'),
    path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../apps/api/data.json'),
  ]
  const dataPath = candidates.find((p) => fs.existsSync(p))
  if (!dataPath) {
    process.stderr.write('Error: data.json not found. Run fetch-my-comments first.\n')
    process.exit(1)
  }

  process.stderr.write(`Reading comments from ${dataPath}…\n`)
  const raw = fs.readFileSync(dataPath, 'utf-8')
  const data = JSON.parse(raw) as { comments: GithubComment[] }

  const corpus = buildCorpus(data.comments, [], [])
  const buckets = bucketByTime(corpus)

  process.stderr.write(
    `Corpus: ${corpus.length} items → early: ${buckets[0]?.items.length ?? 0}, mid: ${buckets[1]?.items.length ?? 0}, recent: ${buckets[2]?.items.length ?? 0}\n`,
  )
  process.stderr.write(`Generating ${PREFERENCE_DIMENSIONS.length} preferences…\n`)

  const agent = createPreferenceAgent(apiKey)
  const preferences = await generatePreferences(agent, PREFERENCE_DIMENSIONS, buckets)

  const outputDir = path.resolve('output')
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, 'preference.json')
  fs.writeFileSync(outputPath, JSON.stringify(preferences, null, 2))

  const names = preferences.map((p) => p.name).join(', ')
  process.stderr.write(`\nDone. ${preferences.length} preference(s) [${names}] written to ${outputPath}\n`)
}

const scriptUrl = new URL(import.meta.url)
const entryUrl = new URL(`file://${path.resolve(process.argv[1] ?? '')}`)
if (scriptUrl.href === entryUrl.href) {
  main().catch((err: unknown) => {
    process.stderr.write(`Error: ${String(err)}\n`)
    process.exit(1)
  })
}
