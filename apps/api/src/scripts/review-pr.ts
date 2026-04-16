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
import Anthropic from '@anthropic-ai/sdk'
import { createOctokitClient } from '@revi/octokit'
import type { OctokitClient } from '@revi/octokit'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single inline review comment targeting a specific file and line. */
export interface ReviewComment {
  path: string
  line: number
  side: 'LEFT' | 'RIGHT'
  body: string
}

/** The structured review produced by the LLM. */
export interface ReviewResult {
  summary: string
  verdict: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'
  comments: ReviewComment[]
}

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

/** A single file in the PR's changeset. */
interface PRFile {
  filename: string
  status: string
  patch?: string
}

/** An existing inline review comment already posted on the PR. */
interface ExistingComment {
  path: string
  line: number
  body: string
}

/** A single entry from `output/skill.json`. */
export interface SkillEntry {
  name: string
  content: string
  tags: string[]
}

const VALID_VERDICTS = new Set(['APPROVE', 'REQUEST_CHANGES', 'COMMENT'])

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit testing)
// ---------------------------------------------------------------------------

/**
 * Reads `output/skill.json` and returns the parsed array of skill entries.
 *
 * @param skillJsonPath - Absolute or relative path to `skill.json`.
 * @throws When the file does not exist or cannot be parsed.
 */
export function loadSkillEntries(skillJsonPath: string): SkillEntry[] {
  const raw = fs.readFileSync(skillJsonPath, 'utf-8')
  return JSON.parse(raw) as SkillEntry[]
}

/**
 * Reads `output/skill.json` and returns all `content` fields concatenated
 * with `---` separators — ready to use as an LLM system prompt.
 *
 * @param skillJsonPath - Absolute or relative path to `skill.json`.
 * @throws When the file does not exist or cannot be parsed.
 */
export function loadSkills(skillJsonPath: string): string {
  return loadSkillEntries(skillJsonPath)
    .map((s) => s.content)
    .join('\n\n---\n\n')
}

/**
 * Formats PR metadata, file diffs, existing comments, and loaded skills into
 * a single user message for the LLM review call.
 *
 * @param meta             - PR title, body, author, branch info.
 * @param files            - Changed files with their diff patches.
 * @param existingComments - Review comments already posted on the PR.
 * @param skills           - Parsed skill entries whose names are listed in the voice instruction.
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
          .map((c) => `- ${c.path}:${c.line} — "${c.body}"`)
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
${skills.map((s) => `- **${s.name}** (${s.tags.join(', ')})`).join('\n')}

Every word you write — each inline comment body and the summary — MUST reflect these skills.
Do not write generic or polished AI feedback. Write exactly as this reviewer would write.

Reply with **only** a JSON object (no markdown fences, no extra text):
{
  "summary": "one short paragraph in the reviewer's voice",
  "verdict": "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
  "comments": [
    { "path": "<file>", "line": <number>, "side": "RIGHT", "body": "<comment in reviewer's voice>" }
  ]
}`
}

/**
 * Parses the raw LLM response into a typed `ReviewResult`.
 * Throws a descriptive error when the JSON is malformed or fields are invalid.
 *
 * @param text - The raw text returned by the LLM.
 */
export function parseReviewResult(text: string): ReviewResult {
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

  if (typeof obj['summary'] !== 'string' || obj['summary'].length === 0) {
    throw new Error('LLM response is missing a valid "summary" string field')
  }
  if (typeof obj['verdict'] !== 'string' || !VALID_VERDICTS.has(obj['verdict'])) {
    throw new Error(
      `LLM response has an invalid "verdict" field: ${String(obj['verdict'])}. Must be APPROVE | REQUEST_CHANGES | COMMENT`,
    )
  }
  if (!Array.isArray(obj['comments'])) {
    throw new Error('LLM response is missing a valid "comments" array field')
  }

  return {
    summary: obj['summary'],
    verdict: obj['verdict'] as ReviewResult['verdict'],
    comments: obj['comments'] as ReviewComment[],
  }
}

/**
 * Maps a `ReviewResult` to the shape expected by GitHub's
 * `POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews` endpoint.
 *
 * @param result - The parsed LLM review output.
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

async function fetchPRFiles(
  client: OctokitClient,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PRFile[]> {
  const { data } = await client.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  })
  return data.map((f) => ({
    filename: f.filename,
    status: f.status,
    patch: f.patch,
  }))
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
      path: c.path,
      // line is already checked above; the cast is safe
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
  await client.request('POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
    owner,
    repo,
    pull_number: pullNumber,
    body: payload.body,
    event: payload.event,
    comments: payload.comments.map((c) => ({
      path: c.path,
      line: c.line,
      side: c.side,
      body: c.body,
    })),
  })
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

  // Read env vars
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
  const systemPrompt = skills.map((s) => s.content).join('\n\n---\n\n')
  process.stderr.write(`  Loaded ${skills.length} skill(s): ${skills.map((s) => s.name).join(', ')}\n`)

  const client = createOctokitClient(githubToken)

  process.stderr.write(`Fetching PR ${owner}/${repo}#${pullNumber}…\n`)
  const [meta, files, existingComments] = await Promise.all([
    fetchPRMeta(client, owner, repo, pullNumber),
    fetchPRFiles(client, owner, repo, pullNumber),
    fetchExistingComments(client, owner, repo, pullNumber),
  ])
  process.stderr.write(
    `  "${meta.title}" — ${files.length} file(s), ${existingComments.length} existing comment(s)\n`,
  )

  const userPrompt = buildUserPrompt(meta, files, existingComments, skills)

  process.stderr.write('Running LLM review…\n')
  const anthropic = new Anthropic({ apiKey: anthropicKey })
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const responseText = message.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('')

  const reviewResult = parseReviewResult(responseText)
  const payload = mapToGithubReview(reviewResult)

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
