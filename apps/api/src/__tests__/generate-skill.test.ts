import { describe, it, expect } from 'vitest'
import type { GithubComment } from '@revi/octokit'

// ---------------------------------------------------------------------------
// Pure helpers from generate-skill are tested here without any network calls.
// ---------------------------------------------------------------------------

const makeComment = (githubId: number, createdAt: string): GithubComment => ({
  githubId,
  username: 'alice',
  type: 'pr_review_comment',
  body: `Comment body ${githubId}`,
  path: 'src/index.ts',
  diffHunk: '@@ -1 +1 @@',
  pullRequestNumber: 1,
  repoOwner: 'alice',
  repoName: 'repo-a',
  createdAt,
  updatedAt: createdAt,
})

// Oldest → newest
const COMMENTS: GithubComment[] = [
  makeComment(1, '2023-01-01T00:00:00Z'),
  makeComment(2, '2023-06-01T00:00:00Z'),
  makeComment(3, '2024-01-01T00:00:00Z'),
  makeComment(4, '2024-06-01T00:00:00Z'),
  makeComment(5, '2025-01-01T00:00:00Z'),
]

describe('sampleRecentComments', () => {
  it('returns at most N comments', async () => {
    const { sampleRecentComments } = await import('../scripts/generate-skill.js')
    const result = sampleRecentComments(COMMENTS, 3)
    expect(result).toHaveLength(3)
  })

  it('returns all comments when N exceeds total', async () => {
    const { sampleRecentComments } = await import('../scripts/generate-skill.js')
    const result = sampleRecentComments(COMMENTS, 100)
    expect(result).toHaveLength(COMMENTS.length)
  })

  it('returns the most-recent comments first', async () => {
    const { sampleRecentComments } = await import('../scripts/generate-skill.js')
    const result = sampleRecentComments(COMMENTS, 3)
    // Most recent first: ids 5, 4, 3
    expect(result[0]?.githubId).toBe(5)
    expect(result[1]?.githubId).toBe(4)
    expect(result[2]?.githubId).toBe(3)
  })

  it('does not mutate the input array', async () => {
    const { sampleRecentComments } = await import('../scripts/generate-skill.js')
    const copy = [...COMMENTS]
    sampleRecentComments(COMMENTS, 3)
    expect(COMMENTS.map((c) => c.githubId)).toEqual(copy.map((c) => c.githubId))
  })
})

describe('buildPrompt', () => {
  it('returns a non-empty string', async () => {
    const { buildPrompt } = await import('../scripts/generate-skill.js')
    const result = buildPrompt(COMMENTS)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('contains the word "review"', async () => {
    const { buildPrompt } = await import('../scripts/generate-skill.js')
    const result = buildPrompt(COMMENTS)
    expect(result.toLowerCase()).toContain('review')
  })

  it('includes each comment body in the prompt', async () => {
    const { buildPrompt } = await import('../scripts/generate-skill.js')
    const subset = COMMENTS.slice(0, 2)
    const result = buildPrompt(subset)
    for (const c of subset) {
      expect(result).toContain(c.body)
    }
  })

  it('works with an empty comments array', async () => {
    const { buildPrompt } = await import('../scripts/generate-skill.js')
    const result = buildPrompt([])
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('parseSkillOutput', () => {
  it('parses valid JSON into a SkillOutput', async () => {
    const { parseSkillOutput } = await import('../scripts/generate-skill.js')
    const input = JSON.stringify({
      name: 'my-review-style',
      content: '# Review Style\nBe concise.',
      tags: ['code-review', 'typescript'],
    })
    const result = parseSkillOutput(input)
    expect(result.name).toBe('my-review-style')
    expect(result.content).toBe('# Review Style\nBe concise.')
    expect(result.tags).toEqual(['code-review', 'typescript'])
  })

  it('throws when JSON is malformed', async () => {
    const { parseSkillOutput } = await import('../scripts/generate-skill.js')
    expect(() => parseSkillOutput('not json')).toThrow()
  })

  it('throws when "name" field is missing', async () => {
    const { parseSkillOutput } = await import('../scripts/generate-skill.js')
    const input = JSON.stringify({ content: 'hello', tags: [] })
    expect(() => parseSkillOutput(input)).toThrow(/name/)
  })

  it('throws when "content" field is missing', async () => {
    const { parseSkillOutput } = await import('../scripts/generate-skill.js')
    const input = JSON.stringify({ name: 'x', tags: [] })
    expect(() => parseSkillOutput(input)).toThrow(/content/)
  })

  it('throws when "tags" is not an array', async () => {
    const { parseSkillOutput } = await import('../scripts/generate-skill.js')
    const input = JSON.stringify({ name: 'x', content: 'y', tags: 'not-array' })
    expect(() => parseSkillOutput(input)).toThrow(/tags/)
  })
})
