/**
 * review-pr.ts
 *
 * One-shot script: reads the generated skills from `output/skill.json`,
 * fetches a pull request from GitHub, runs an LLM code review using the
 * skills as the system prompt, and posts the review back to GitHub in a
 * single batch call.
 *
 * Usage:
 *   GITHUB_TOKEN=<pat> ANTHROPIC_API_KEY=<key> \
 *     yarn workspace @revi/api review-pr <owner>/<repo> <pull_number>
 */

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import { Agent } from '@mastra/core/agent'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOctokitClient, fetchPRDiff } from '@revi/octokit'
import type { OctokitClient, PRFile } from '@revi/octokit'

// ---------------------------------------------------------------------------
// Output schemas — single source of truth for LLM structured output
// ---------------------------------------------------------------------------

export const ReviewCommentSchema = z.object({
  path: z.string().optional(),
  line: z.number().int().optional(),
  side: z.enum(['LEFT', 'RIGHT']).optional(),
  /** Set this to reply to an existing comment thread instead of posting a new inline comment. */
  in_reply_to_id: z.number().int().optional(),
  body: z.string().min(1),
})

export const ReviewResultSchema = z.object({
  summary: z.string().min(1),
  verdict: z.enum(['APPROVE', 'REQUEST_CHANGES', 'COMMENT']),
  comments: z.array(ReviewCommentSchema),
})

export type ReviewComment = z.infer<typeof ReviewCommentSchema>
export type ReviewResult = z.infer<typeof ReviewResultSchema>

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The payload sent to GitHub's `POST /pulls/{n}/reviews` endpoint. */
export interface GithubReviewPayload {
  body: string
  event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'
  comments: ReviewComment[]
}

/** PR metadata returned by GitHub. */
interface PRMeta {
  title: string
  body: string | null
  user: string
  base: string
  head: string
}

/** An existing inline review comment already posted on the PR. */
export interface ExistingComment {
  id: number
  author: string
  path: string
  line: number
  body: string
}

/** A single entry from `output/skill.json`. */
export interface SkillEntry {
  name: string
  content: string
  tags?: string[]
}

/** A single preference entry from the DB. */
export interface PreferenceEntry {
  name: string
  dimension: string
  content: string
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit testing)
// ---------------------------------------------------------------------------

/**
 * Reads `output/skill.json` and returns the parsed array of skill entries.
 */
export function loadSkillEntries(skillJsonPath: string): SkillEntry[] {
  const raw = fs.readFileSync(skillJsonPath, 'utf-8')
  return JSON.parse(raw) as SkillEntry[]
}

/**
 * Returns all `content` fields from skill entries concatenated with `---`
 * separators — ready to use as an LLM system prompt.
 */
export function loadSkills(skillJsonPath: string): string {
  return loadSkillEntries(skillJsonPath)
    .map((s) => s.content)
    .join('\n\n---\n\n')
}

/**
 * Builds the full system prompt for the review agent.
 *
 * Skills encode the reviewer's technical patterns and coding rules.
 * Preferences encode their communication style and behaviour — used as the
 * mandatory self-check so the reviewer's voice is grounded in real data
 * rather than hardcoded heuristics.
 */
export function buildSystemPrompt(skills: SkillEntry[], preferences: PreferenceEntry[] = []): string {
  const skillsBlock = skills.map((s) => s.content).join('\n\n---\n\n')

  const selfCheck =
    preferences.length > 0
      ? preferences.map((p) => `### ${p.name}\n${p.content}`).join('\n\n')
      : '*(no preferences loaded — write in a natural, human tone)*'

  return `# YOUR IDENTITY

You are NOT an AI assistant writing a code review. You ARE a specific software engineer — a real person with a defined voice, opinions, and habits. The skills and preferences below are not guidelines to consider; they ARE who you are.

Every word you produce must be indistinguishable from a comment this person actually wrote. If you catch yourself defaulting to polished, thorough, or AI-sounding language, stop and rewrite it.

---

# YOUR SKILLS — technical patterns and coding rules

${skillsBlock}

---

# YOUR PREFERENCES — communication style and behaviour

These are derived from your real GitHub activity. They define HOW you write, not what you review.

${selfCheck}

---

# REPLYING TO EXISTING COMMENTS

Existing review comments are listed in the user message with their numeric IDs in brackets, e.g. [#123]. If you want to reply directly to one of those threads instead of leaving a new inline comment, output a comment with in_reply_to_id set to that number and omit path, line, and side. Only reply when your response is a genuine follow-up to that specific comment. If a new standalone comment is more appropriate, use the normal path/line/side format instead.

---

# MANDATORY SELF-CHECK — run this before writing each comment or summary

Verify every word against your preferences above. Additionally:

- **No AI punctuation**: Never use em dashes (-), en dashes, ellipsis characters, or typographic quotes. Only characters a human types on a keyboard.
- **No formal language**: Never write "It would be advisable to ...", "Please ensure that ...", "This approach may lead to ...", or similar.
- **One concern per comment**: State each issue exactly once. If you cannot say it in 1-2 sentences, cut it or drop it.

**If a comment fails any point above, rewrite it until it passes, or drop it.**`
}

/**
 * Formats PR metadata, file diffs, existing comments, and loaded skills into
 * a single user message for the review agent.
 */
export function buildUserPrompt(
  meta: PRMeta,
  files: PRFile[],
  existingComments: ExistingComment[],
  skills: SkillEntry[],
): string {
  const fileSections = files
    .map((f) => {
      const header = `#### ${f.filename} (${f.status})`
      const patch = f.patch ? `\`\`\`diff\n${f.patch}\n\`\`\`` : '*(binary or empty)*'
      return `${header}\n${patch}`
    })
    .join('\n\n')

  const existingSection =
    existingComments.length > 0
      ? existingComments
          .map((c) => `- [#${c.id}] @${c.author} on ${c.path}:${c.line} — "${c.body}"`)
          .join('\n')
      : '*(none)*'

  return `## PR: ${meta.title}
**Author:** ${meta.user}  **Branch:** ${meta.base} ← ${meta.head}

### Description
${meta.body ?? '*(no description)*'}

### Files changed (${files.length} file${files.length === 1 ? '' : 's'})

${fileSections || '*(no text files changed)*'}

### Existing review comments (${existingComments.length})
${existingSection}

---
## Apply your loaded skills

Your system prompt contains ${skills.length} reviewer-style skill${skills.length === 1 ? '' : 's'}:
${skills.map((s) => `- **${s.name}**${s.tags && s.tags.length > 0 ? ` (${s.tags.join(', ')})` : ''}`).join('\n')}

**MANDATORY — non-negotiable:** Every single word you write — each inline comment body and the summary — MUST sound exactly like this reviewer. Use their vocabulary, tone, cadence, and opinions as described in the skills above. Generic, polished, or AI-sounding feedback is a failure. If a comment does not sound like it was written by this specific reviewer, do not include it.`
}

/**
 * Parses raw LLM text into a typed `ReviewResult` via the Zod schema.
 * Throws a descriptive error when the JSON is malformed or fields are invalid.
 */
export function parseReviewResult(text: string): ReviewResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`LLM response is not valid JSON: ${text.slice(0, 200)}`)
  }
  try {
    return ReviewResultSchema.parse(parsed)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`LLM response failed schema validation: ${msg}`)
  }
}

/**
 * Maps a `ReviewResult` to the shape expected by GitHub's
 * `POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews` endpoint.
 */
export function mapToGithubReview(result: ReviewResult): GithubReviewPayload {
  return {
    body: result.summary,
    event: result.verdict,
    comments: result.comments,
  }
}

// ---------------------------------------------------------------------------
// Network functions — only called from main(), not unit tested
// ---------------------------------------------------------------------------

async function fetchPRMeta(
  client: OctokitClient,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PRMeta> {
  const { data } = await client.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
    owner,
    repo,
    pull_number: pullNumber,
  })
  return {
    title: data.title,
    body: data.body ?? null,
    user: data.user?.login ?? 'unknown',
    base: data.base.ref,
    head: data.head.ref,
  }
}

async function fetchExistingComments(
  client: OctokitClient,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<ExistingComment[]> {
  const { data } = await client.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/comments', {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  })
  return data
    .filter((c) => c.path !== undefined && c.line !== undefined)
    .map((c) => ({
      id: c.id,
      author: c.user?.login ?? 'unknown',
      path: c.path,
      line: c.line as number,
      body: c.body,
    }))
}

async function postReview(
  client: OctokitClient,
  owner: string,
  repo: string,
  pullNumber: number,
  payload: GithubReviewPayload,
): Promise<void> {
  const newComments = payload.comments.filter((c) => !c.in_reply_to_id)
  const replies = payload.comments.filter((c) => !!c.in_reply_to_id)

  await client.request('POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
    owner,
    repo,
    pull_number: pullNumber,
    body: payload.body,
    event: payload.event,
    comments: newComments.map((c) => ({
      path: c.path!,
      line: c.line!,
      side: c.side!,
      body: c.body,
    })),
  })

  for (const reply of replies) {
    await client.request(
      'POST /repos/{owner}/{repo}/pulls/comments/{comment_id}/replies',
      { owner, repo, comment_id: reply.in_reply_to_id!, body: reply.body },
    )
  }
}

// ---------------------------------------------------------------------------
// Script entrypoint — only runs when executed directly, not when imported
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Parse CLI args
  const [ownerRepo, pullArg] = [process.argv[2], process.argv[3]]
  if (!ownerRepo || !pullArg) {
    process.stderr.write('Usage: review-pr <owner>/<repo> <pull_number>\n')
    process.exit(1)
  }
  const slashIdx = ownerRepo.indexOf('/')
  if (slashIdx === -1) {
    process.stderr.write('Error: first argument must be in the format <owner>/<repo>\n')
    process.exit(1)
  }
  const owner = ownerRepo.slice(0, slashIdx)
  const repo = ownerRepo.slice(slashIdx + 1)
  const pullNumber = parseInt(pullArg, 10)
  if (isNaN(pullNumber) || pullNumber <= 0) {
    process.stderr.write('Error: pull_number must be a positive integer\n')
    process.exit(1)
  }

  const githubToken = process.env['GITHUB_TOKEN']
  const anthropicKey = process.env['ANTHROPIC_API_KEY']
  if (!githubToken || githubToken.length === 0) {
    process.stderr.write('Error: GITHUB_TOKEN environment variable is required but not set.\n')
    process.exit(1)
  }
  if (!anthropicKey || anthropicKey.length === 0) {
    process.stderr.write('Error: ANTHROPIC_API_KEY environment variable is required but not set.\n')
    process.exit(1)
  }

  // Resolve skill.json
  const skillCandidates = [
    path.resolve('output/skill.json'),
    path.resolve('apps/api/output/skill.json'),
  ]
  const skillPath = skillCandidates.find((p) => fs.existsSync(p))
  if (!skillPath) {
    process.stderr.write('Error: output/skill.json not found. Run generate-skill first.\n')
    process.exit(1)
  }

  process.stderr.write(`Loading skills from ${skillPath}…\n`)
  const skills = loadSkillEntries(skillPath)
  process.stderr.write(`  Loaded ${skills.length} skill(s): ${skills.map((s) => s.name).join(', ')}\n`)

  const systemPrompt = buildSystemPrompt(skills)
  const agent = new Agent({
    id: 'code-reviewer',
    name: 'code-reviewer',
    instructions: systemPrompt,
    model: createAnthropic({ apiKey: anthropicKey })('claude-sonnet-4-6'),
  })

  const client = createOctokitClient(githubToken)

  process.stderr.write(`Fetching PR ${owner}/${repo}#${pullNumber}…\n`)
  const [meta, files, existingComments] = await Promise.all([
    fetchPRMeta(client, owner, repo, pullNumber),
    fetchPRDiff(client, owner, repo, pullNumber),
    fetchExistingComments(client, owner, repo, pullNumber),
  ])
  process.stderr.write(
    `  "${meta.title}" — ${files.length} file(s), ${existingComments.length} existing comment(s)\n`,
  )

  const userPrompt = buildUserPrompt(meta, files, existingComments, skills)

  process.stderr.write('Running LLM review…\n')
  const { object: result } = await agent.generate(userPrompt, {
    structuredOutput: { schema: ReviewResultSchema },
  })

  const payload = mapToGithubReview(result)

  process.stderr.write(
    `Posting review (verdict: ${payload.event}, ${payload.comments.length} inline comment(s))…\n`,
  )
  await postReview(client, owner, repo, pullNumber, payload)

  process.stderr.write(`\nDone. Review posted to ${owner}/${repo}#${pullNumber}\n`)
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
