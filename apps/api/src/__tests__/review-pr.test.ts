import { describe, it, expect } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type { ReviewResult } from '../scripts/review-pr.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Write a temp JSON file and return its path. Caller is responsible for cleanup. */
function writeTempJson(data: unknown): string {
  const tmpPath = path.join(os.tmpdir(), `revi-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`)
  fs.writeFileSync(tmpPath, JSON.stringify(data))
  return tmpPath
}

const SAMPLE_META = {
  title: 'Add OAuth login',
  body: 'Implements the OAuth flow described in #12.',
  user: 'alice',
  base: 'main',
  head: 'feature/oauth',
}

const SAMPLE_FILES = [
  { filename: 'src/auth.ts', status: 'added', patch: '@@ -0,0 +1,10 @@\n+export function login() {}' },
  { filename: 'src/config.ts', status: 'modified', patch: '@@ -1,3 +1,4 @@\n+import { env } from "./env"' },
]

const SAMPLE_COMMENTS = [
  { path: 'src/auth.ts', line: 3, body: 'this can be extracted' },
]

const VALID_REVIEW_JSON: ReviewResult = {
  summary: 'Overall looks solid.',
  verdict: 'APPROVE',
  comments: [
    { path: 'src/auth.ts', line: 5, side: 'RIGHT', body: 'consider using async/await here' },
  ],
}

// ---------------------------------------------------------------------------
// loadSkills
// ---------------------------------------------------------------------------

describe('loadSkills', () => {
  it('returns concatenated content from a skill JSON array', async () => {
    const { loadSkills } = await import('../scripts/review-pr.js')
    const skills = [
      { name: 'skill-a', content: 'Be concise.', tags: ['style'] },
      { name: 'skill-b', content: 'Prefer interfaces.', tags: ['typescript'] },
    ]
    const tmpPath = writeTempJson(skills)
    try {
      const result = loadSkills(tmpPath)
      expect(result).toContain('Be concise.')
      expect(result).toContain('Prefer interfaces.')
    } finally {
      fs.unlinkSync(tmpPath)
    }
  })

  it('joins multiple skills with a separator', async () => {
    const { loadSkills } = await import('../scripts/review-pr.js')
    const skills = [
      { name: 'a', content: 'AAA', tags: [] },
      { name: 'b', content: 'BBB', tags: [] },
    ]
    const tmpPath = writeTempJson(skills)
    try {
      const result = loadSkills(tmpPath)
      // Both should appear and there should be something between them
      const idxA = result.indexOf('AAA')
      const idxB = result.indexOf('BBB')
      expect(idxA).toBeGreaterThanOrEqual(0)
      expect(idxB).toBeGreaterThan(idxA)
    } finally {
      fs.unlinkSync(tmpPath)
    }
  })

  it('throws when file does not exist', async () => {
    const { loadSkills } = await import('../scripts/review-pr.js')
    expect(() => loadSkills('/no/such/file/skill.json')).toThrow()
  })
})

// ---------------------------------------------------------------------------
// buildUserPrompt
// ---------------------------------------------------------------------------

describe('buildUserPrompt', () => {
  it('returns a non-empty string', async () => {
    const { buildUserPrompt } = await import('../scripts/review-pr.js')
    const result = buildUserPrompt(SAMPLE_META, SAMPLE_FILES, SAMPLE_COMMENTS)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('includes the PR title', async () => {
    const { buildUserPrompt } = await import('../scripts/review-pr.js')
    const result = buildUserPrompt(SAMPLE_META, SAMPLE_FILES, SAMPLE_COMMENTS)
    expect(result).toContain(SAMPLE_META.title)
  })

  it('includes each changed filename', async () => {
    const { buildUserPrompt } = await import('../scripts/review-pr.js')
    const result = buildUserPrompt(SAMPLE_META, SAMPLE_FILES, [])
    for (const f of SAMPLE_FILES) {
      expect(result).toContain(f.filename)
    }
  })

  it('includes existing comment bodies', async () => {
    const { buildUserPrompt } = await import('../scripts/review-pr.js')
    const result = buildUserPrompt(SAMPLE_META, [], SAMPLE_COMMENTS)
    expect(result).toContain(SAMPLE_COMMENTS[0]?.body)
  })

  it('works with no existing comments', async () => {
    const { buildUserPrompt } = await import('../scripts/review-pr.js')
    const result = buildUserPrompt(SAMPLE_META, SAMPLE_FILES, [])
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('works with no files', async () => {
    const { buildUserPrompt } = await import('../scripts/review-pr.js')
    const result = buildUserPrompt(SAMPLE_META, [], [])
    expect(result).toContain(SAMPLE_META.title)
  })

  it('includes a JSON reply instruction', async () => {
    const { buildUserPrompt } = await import('../scripts/review-pr.js')
    const result = buildUserPrompt(SAMPLE_META, [], [])
    expect(result).toContain('JSON')
  })
})

// ---------------------------------------------------------------------------
// parseReviewResult
// ---------------------------------------------------------------------------

describe('parseReviewResult', () => {
  it('parses a valid review JSON', async () => {
    const { parseReviewResult } = await import('../scripts/review-pr.js')
    const result = parseReviewResult(JSON.stringify(VALID_REVIEW_JSON))
    expect(result.summary).toBe('Overall looks solid.')
    expect(result.verdict).toBe('APPROVE')
    expect(result.comments).toHaveLength(1)
  })

  it('accepts all three valid verdict values', async () => {
    const { parseReviewResult } = await import('../scripts/review-pr.js')
    for (const verdict of ['APPROVE', 'REQUEST_CHANGES', 'COMMENT'] as const) {
      const result = parseReviewResult(JSON.stringify({ ...VALID_REVIEW_JSON, verdict }))
      expect(result.verdict).toBe(verdict)
    }
  })

  it('throws on malformed JSON', async () => {
    const { parseReviewResult } = await import('../scripts/review-pr.js')
    expect(() => parseReviewResult('not json')).toThrow()
  })

  it('throws when summary is missing', async () => {
    const { parseReviewResult } = await import('../scripts/review-pr.js')
    const { summary: _s, ...noSummary } = VALID_REVIEW_JSON
    expect(() => parseReviewResult(JSON.stringify(noSummary))).toThrow(/summary/)
  })

  it('throws when verdict is not a valid value', async () => {
    const { parseReviewResult } = await import('../scripts/review-pr.js')
    const bad = { ...VALID_REVIEW_JSON, verdict: 'MERGE' }
    expect(() => parseReviewResult(JSON.stringify(bad))).toThrow(/verdict/)
  })

  it('throws when comments is not an array', async () => {
    const { parseReviewResult } = await import('../scripts/review-pr.js')
    const bad = { ...VALID_REVIEW_JSON, comments: 'none' }
    expect(() => parseReviewResult(JSON.stringify(bad))).toThrow(/comments/)
  })
})

// ---------------------------------------------------------------------------
// mapToGithubReview
// ---------------------------------------------------------------------------

describe('mapToGithubReview', () => {
  it('maps summary to body', async () => {
    const { mapToGithubReview } = await import('../scripts/review-pr.js')
    const payload = mapToGithubReview(VALID_REVIEW_JSON)
    expect(payload.body).toBe(VALID_REVIEW_JSON.summary)
  })

  it('maps verdict to event', async () => {
    const { mapToGithubReview } = await import('../scripts/review-pr.js')
    const payload = mapToGithubReview(VALID_REVIEW_JSON)
    expect(payload.event).toBe(VALID_REVIEW_JSON.verdict)
  })

  it('passes comments through unchanged', async () => {
    const { mapToGithubReview } = await import('../scripts/review-pr.js')
    const payload = mapToGithubReview(VALID_REVIEW_JSON)
    expect(payload.comments).toHaveLength(VALID_REVIEW_JSON.comments.length)
    expect(payload.comments[0]?.path).toBe(VALID_REVIEW_JSON.comments[0]?.path)
    expect(payload.comments[0]?.line).toBe(VALID_REVIEW_JSON.comments[0]?.line)
    expect(payload.comments[0]?.body).toBe(VALID_REVIEW_JSON.comments[0]?.body)
  })

  it('works for REQUEST_CHANGES verdict', async () => {
    const { mapToGithubReview } = await import('../scripts/review-pr.js')
    const result: ReviewResult = { ...VALID_REVIEW_JSON, verdict: 'REQUEST_CHANGES' }
    const payload = mapToGithubReview(result)
    expect(payload.event).toBe('REQUEST_CHANGES')
  })

  it('produces an empty comments array when no inline comments', async () => {
    const { mapToGithubReview } = await import('../scripts/review-pr.js')
    const result: ReviewResult = { ...VALID_REVIEW_JSON, comments: [] }
    const payload = mapToGithubReview(result)
    expect(payload.comments).toHaveLength(0)
  })
})
