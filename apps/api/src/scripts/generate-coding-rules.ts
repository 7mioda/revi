/**
 * generate-coding-rules.ts
 *
 * Analyses a developer's GitHub activity (PR diffs + code review comments)
 * to extract concrete do/don't programming rules per skill dimension.
 *
 * Uses a parallel map → reduce strategy to handle large histories efficiently:
 *   Map:    all corpus chunks extracted simultaneously (p-limit 5)
 *   Reduce: one merge call per dimension synthesises results using time metadata
 *
 * Uses a Mastra Agent with a Zod output schema for typed structured output.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=<key> yarn workspace @revi/api generate-coding-rules
 *
 * Output: `apps/api/output/coding-rules.json` — a CodingRuleOutput[] array
 */

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import pLimit from 'p-limit'
import { Agent } from '@mastra/core/agent'
import { createAnthropic } from '@ai-sdk/anthropic'
import { SKILL_DIMENSIONS } from './generate-skill.js'
import type { SkillDimension } from './generate-skill.js'

export { SKILL_DIMENSIONS }
export type { SkillDimension }

// ---------------------------------------------------------------------------
// Output schema
// ---------------------------------------------------------------------------

export const CodingRuleOutputSchema = z.object({
  name: z.string().min(1),
  dimension: z.string().min(1),
  content: z.string().min(1),
  tags: z.array(z.string()),
})

export type CodingRuleOutput = z.infer<typeof CodingRuleOutputSchema>

// ---------------------------------------------------------------------------
// Corpus types
// ---------------------------------------------------------------------------

/** A single item in the coding corpus. */
export interface CorpusItem {
  source: 'pr' | 'comment'
  /** Patch text (PR) or comment body. */
  body: string
  /** PR title+description or comment diffHunk. */
  context?: string
  repoOwner?: string
  repoName?: string
  /** ISO 8601 timestamp — used to sort and label chunks chronologically. */
  createdAt?: string
}

/** Lightweight PR shape accepted by buildCodingCorpus. */
export interface RawPR {
  title: string
  body?: string | null
  repoOwner?: string
  repoName?: string
  createdAt?: string
  files?: Array<{ filename: string; status: string; patch?: string }>
}

/** Lightweight comment shape accepted by buildCodingCorpus. */
export interface RawCodeComment {
  body: string
  diffHunk?: string | null
  repoOwner?: string
  repoName?: string
  createdAt?: string
}

/** A chunk annotated with its date range and position. */
export interface TimedCorpusChunk {
  items: CorpusItem[]
  /** ISO date string of the earliest item in this chunk, or '' if unavailable. */
  from: string
  /** ISO date string of the latest item in this chunk, or '' if unavailable. */
  to: string
  /** 0-based chronological position. */
  index: number
}

/** Rules extracted from one chunk, carrying its time metadata for the merge phase. */
export interface TimedChunkRules {
  rules: CodingRuleOutput
  from: string
  to: string
  index: number
}

// Items per LLM call — keep well under context limits.
// At ~500 tokens/item average, 15 items ≈ 7.5k tokens of corpus per call.
export const CHUNK_SIZE = 15

// Max concurrent LLM calls in the map phase.
const CONCURRENCY = 5

// Max lines kept per file patch — prevents a single large file from dominating.
const MAX_PATCH_LINES = 60

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit testing)
// ---------------------------------------------------------------------------

/** Truncates a unified-diff patch to at most `maxLines` lines. */
export function truncatePatch(patch: string, maxLines = MAX_PATCH_LINES): string {
  const lines = patch.split('\n')
  if (lines.length <= maxLines) return patch
  return lines.slice(0, maxLines).join('\n') + `\n… (${lines.length - maxLines} lines omitted)`
}

/**
 * Builds a flat corpus from PR diffs and code review comments, sorted
 * chronologically by createdAt so chunks represent time windows.
 */
export function buildCodingCorpus(prs: RawPR[], comments: RawCodeComment[]): CorpusItem[] {
  const items: CorpusItem[] = []

  for (const pr of prs) {
    const patches = (pr.files ?? [])
      .map((f) => (f.patch ? `--- ${f.filename}\n${truncatePatch(f.patch)}` : ''))
      .filter((p) => p.length > 0)
      .join('\n\n')

    if (patches.length === 0 && !pr.body && !pr.title) continue

    const context = [pr.title, pr.body?.trim()].filter(Boolean).join('\n\n')
    items.push({
      source: 'pr',
      body: patches.length > 0 ? patches : pr.title,
      context: context.length > 0 ? context : undefined,
      repoOwner: pr.repoOwner,
      repoName: pr.repoName,
      createdAt: pr.createdAt,
    })
  }

  for (const c of comments) {
    if (c.body.trim().length === 0) continue
    items.push({
      source: 'comment',
      body: c.body,
      context: c.diffHunk ? truncatePatch(c.diffHunk) : undefined,
      repoOwner: c.repoOwner,
      repoName: c.repoName,
      createdAt: c.createdAt,
    })
  }

  // Sort chronologically — items without dates go last.
  return items.sort((a, b) => {
    if (!a.createdAt && !b.createdAt) return 0
    if (!a.createdAt) return 1
    if (!b.createdAt) return -1
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
}

/**
 * Splits a chronologically sorted corpus into chunks of `size`, attaching
 * date-range metadata to each chunk for use in time-aware prompts.
 */
export function chunkCorpusTimed(corpus: CorpusItem[], size: number): TimedCorpusChunk[] {
  const chunks: TimedCorpusChunk[] = []
  for (let i = 0; i < corpus.length; i += size) {
    const items = corpus.slice(i, i + size)
    const dates = items.map((it) => it.createdAt).filter((d): d is string => !!d)
    chunks.push({
      items,
      from: dates[0]?.slice(0, 10) ?? '',
      to: dates[dates.length - 1]?.slice(0, 10) ?? '',
      index: chunks.length,
    })
  }
  return chunks
}

/** Formats a single CorpusItem for inclusion in a prompt. */
function formatItem(item: CorpusItem): string {
  const repo = item.repoOwner && item.repoName ? `${item.repoOwner}/${item.repoName}` : 'unknown'
  const header = `[source: ${item.source} | repo: ${repo}]`
  const lines: string[] = [header]
  if (item.context) lines.push(item.context)
  lines.push(item.body)
  return lines.join('\n')
}

/**
 * Extraction prompt for a single timed chunk.
 */
export function buildExtractPrompt(dimension: SkillDimension, chunk: TimedCorpusChunk): string {
  const prCount = chunk.items.filter((i) => i.source === 'pr').length
  const commentCount = chunk.items.filter((i) => i.source === 'comment').length
  const timeRange = chunk.from && chunk.to ? ` (${chunk.from} → ${chunk.to})` : ''
  const sections = chunk.items.map(formatItem).join('\n\n---\n\n')

  return `You are a code-review rule extractor. Below is batch ${chunk.index + 1}${timeRange} — ${chunk.items.length} items from a developer's GitHub activity (${prCount} pull request diffs, ${commentCount} review comments).

Extract concrete programming rules — specific DO and DON'T statements — for this dimension:
**${dimension.focus}**

Rules must be grounded in evidence from this batch. Do not invent rules not supported by the data.
If the batch contains insufficient evidence for a rule, omit it rather than speculating.

The "content" field must be a markdown list of DO/DON'T rules, e.g.:
- DO: use early returns to reduce nesting
- DON'T: throw generic Error objects without a message

${'='.repeat(60)}

${sections}`
}

/**
 * Merge prompt — synthesises N time-ordered chunk rule sets into one final set.
 */
export function buildMergePrompt(dimension: SkillDimension, chunkResults: TimedChunkRules[]): string {
  const batchSections = chunkResults
    .map((cr) => {
      const range = cr.from && cr.to ? ` (${cr.from} → ${cr.to})` : ''
      return `BATCH ${cr.index + 1}${range}:\n${cr.rules.content}`
    })
    .join('\n\n' + '-'.repeat(40) + '\n\n')

  return `You are a code-review rule extractor. You have analysed ${chunkResults.length} time-ordered batches of a developer's GitHub activity for this dimension:
**${dimension.focus}**

Below are the rule sets extracted from each batch, in chronological order:

${batchSections}

${'='.repeat(60)}

Synthesise these into a single final rule set:
- Rules consistent across multiple periods are strong signals — keep them
- More recent batches may reflect evolved practice — weight slightly higher
- Rules from only one early batch that are contradicted later — remove or soften
- Deduplicate overlapping rules into one clear statement

Return the complete final rule set as a JSON object.`
}

// ---------------------------------------------------------------------------
// Mastra Agent factory
// ---------------------------------------------------------------------------

export function createCodingRulesAgent(apiKey: string): Agent {
  return new Agent({
    id: 'coding-rules-analyst',
    name: 'coding-rules-analyst',
    instructions:
      "You are a code-review rule extractor. Analyse the GitHub activity provided and produce a structured list of do/don't programming rules for the requested dimension.",
    model: createAnthropic({ apiKey })('claude-sonnet-4-6'),
  })
}

// ---------------------------------------------------------------------------
// Generation loop — parallel map → reduce
// ---------------------------------------------------------------------------

/**
 * For each dimension:
 *   Phase 1 (map): all chunks extracted in parallel (p-limit CONCURRENCY)
 *   Phase 2 (reduce): one merge call synthesises chunk results using time metadata
 *
 * Single-chunk corpora skip the merge call entirely.
 * Calls `onResult` after each dimension completes.
 */
export async function generateCodingRules(
  agent: Agent,
  dimensions: SkillDimension[],
  corpus: CorpusItem[],
  onResult?: (rule: CodingRuleOutput) => Promise<void>,
): Promise<CodingRuleOutput[]> {
  const timedChunks = chunkCorpusTimed(corpus, CHUNK_SIZE)
  const results: CodingRuleOutput[] = []

  if (timedChunks.length === 0) {
    process.stderr.write('  Warning: empty corpus, skipping rule generation.\n')
    return results
  }

  const limit = pLimit(CONCURRENCY)

  for (const dimension of dimensions) {
    process.stderr.write(
      `  [${dimension.key}] map phase: extracting from ${timedChunks.length} chunk${timedChunks.length > 1 ? 's' : ''} in parallel…\n`,
    )

    // Phase 1 — map: extract rules from every chunk concurrently
    const chunkResults: TimedChunkRules[] = await Promise.all(
      timedChunks.map((chunk) =>
        limit(async () => {
          process.stderr.write(`    chunk ${chunk.index + 1}/${timedChunks.length} extracting…\n`)
          const prompt = buildExtractPrompt(dimension, chunk)
          const { object } = await agent.generate(prompt, {
            structuredOutput: { schema: CodingRuleOutputSchema },
          })
          process.stderr.write(`    chunk ${chunk.index + 1}/${timedChunks.length} done.\n`)
          return { rules: object, from: chunk.from, to: chunk.to, index: chunk.index }
        }),
      ),
    )

    // Phase 2 — reduce: merge when there is more than one chunk
    let final: CodingRuleOutput
    if (chunkResults.length === 1) {
      final = chunkResults[0]!.rules
    } else {
      process.stderr.write(`  [${dimension.key}] reduce phase: merging ${chunkResults.length} chunk results…\n`)
      const mergePrompt = buildMergePrompt(dimension, chunkResults)
      const { object } = await agent.generate(mergePrompt, {
        structuredOutput: { schema: CodingRuleOutputSchema },
      })
      final = object
    }

    results.push(final)
    await onResult?.(final)
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

  process.stderr.write(`Reading data from ${dataPath}…\n`)
  const raw = fs.readFileSync(dataPath, 'utf-8')
  const data = JSON.parse(raw) as { comments?: RawCodeComment[]; prs?: RawPR[] }

  const corpus = buildCodingCorpus(data.prs ?? [], data.comments ?? [])
  const timedChunks = chunkCorpusTimed(corpus, CHUNK_SIZE)
  process.stderr.write(
    `Corpus: ${corpus.length} items → ${timedChunks.length} chunks of ${CHUNK_SIZE} (${corpus.filter((i) => i.source === 'pr').length} PRs, ${corpus.filter((i) => i.source === 'comment').length} comments)\n`,
  )
  process.stderr.write(`Generating ${SKILL_DIMENSIONS.length} coding rule sets…\n`)

  const agent = createCodingRulesAgent(apiKey)
  const rules = await generateCodingRules(agent, SKILL_DIMENSIONS, corpus)

  const outputDir = path.resolve('output')
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, 'coding-rules.json')
  fs.writeFileSync(outputPath, JSON.stringify(rules, null, 2))

  const names = rules.map((r) => r.name).join(', ')
  process.stderr.write(`\nDone. ${rules.length} rule set(s) [${names}] written to ${outputPath}\n`)
}

const scriptUrl = new URL(import.meta.url)
const entryUrl = new URL(`file://${path.resolve(process.argv[1] ?? '')}`)
if (scriptUrl.href === entryUrl.href) {
  main().catch((err: unknown) => {
    process.stderr.write(`Error: ${String(err)}\n`)
    process.exit(1)
  })
}
