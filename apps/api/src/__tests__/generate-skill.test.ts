import { describe, it, expect, vi } from 'vitest'
import type { GithubComment } from '@revi/octokit'
import type Anthropic from '@anthropic-ai/sdk'
import type { SkillDimension } from '../scripts/generate-skill.js'

// ---------------------------------------------------------------------------
// Pure helpers from generate-skill are tested here without any network calls.
// ---------------------------------------------------------------------------

/** Narrows SKILL_DIMENSIONS[index] — throws if index is out of range. */
function getDimension(dims: SkillDimension[], index: number): SkillDimension {
  const dim = dims[index]
  if (!dim) throw new Error(`SKILL_DIMENSIONS[${index}] does not exist`)
  return dim
}

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

// ---------------------------------------------------------------------------
// sampleRecentComments — unchanged contract
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// SKILL_DIMENSIONS — exported constant
// ---------------------------------------------------------------------------

describe('SKILL_DIMENSIONS', () => {
  it('exports an array with at least 3 dimensions', async () => {
    const { SKILL_DIMENSIONS } = await import('../scripts/generate-skill.js')
    expect(Array.isArray(SKILL_DIMENSIONS)).toBe(true)
    expect(SKILL_DIMENSIONS.length).toBeGreaterThanOrEqual(3)
  })

  it('each dimension has key, focus, and tags fields', async () => {
    const { SKILL_DIMENSIONS } = await import('../scripts/generate-skill.js')
    for (const dim of SKILL_DIMENSIONS) {
      expect(typeof dim.key).toBe('string')
      expect(dim.key.length).toBeGreaterThan(0)
      expect(typeof dim.focus).toBe('string')
      expect(dim.focus.length).toBeGreaterThan(0)
      expect(Array.isArray(dim.tags)).toBe(true)
      expect(dim.tags.length).toBeGreaterThan(0)
    }
  })

  it('dimension keys are unique', async () => {
    const { SKILL_DIMENSIONS } = await import('../scripts/generate-skill.js')
    const keys = SKILL_DIMENSIONS.map((d: { key: string }) => d.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

// ---------------------------------------------------------------------------
// buildPrompt — now takes (dimension, comments)
// ---------------------------------------------------------------------------

describe('buildPrompt', () => {
  it('returns a non-empty string', async () => {
    const { buildPrompt, SKILL_DIMENSIONS } = await import('../scripts/generate-skill.js')
    const result = buildPrompt(getDimension(SKILL_DIMENSIONS, 0), COMMENTS)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('contains the word "review"', async () => {
    const { buildPrompt, SKILL_DIMENSIONS } = await import('../scripts/generate-skill.js')
    const result = buildPrompt(getDimension(SKILL_DIMENSIONS, 0), COMMENTS)
    expect(result.toLowerCase()).toContain('review')
  })

  it('includes the dimension focus text in the prompt', async () => {
    const { buildPrompt, SKILL_DIMENSIONS } = await import('../scripts/generate-skill.js')
    for (const dim of SKILL_DIMENSIONS) {
      const result = buildPrompt(dim, COMMENTS)
      expect(result).toContain(dim.focus)
    }
  })

  it('includes each comment body in the prompt', async () => {
    const { buildPrompt, SKILL_DIMENSIONS } = await import('../scripts/generate-skill.js')
    const subset = COMMENTS.slice(0, 2)
    const result = buildPrompt(getDimension(SKILL_DIMENSIONS, 0), subset)
    for (const c of subset) {
      expect(result).toContain(c.body)
    }
  })

  it('works with an empty comments array', async () => {
    const { buildPrompt, SKILL_DIMENSIONS } = await import('../scripts/generate-skill.js')
    const result = buildPrompt(getDimension(SKILL_DIMENSIONS, 0), [])
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('produces different prompts for different dimensions', async () => {
    const { buildPrompt, SKILL_DIMENSIONS } = await import('../scripts/generate-skill.js')
    const p1 = buildPrompt(getDimension(SKILL_DIMENSIONS, 0), COMMENTS)
    const p2 = buildPrompt(getDimension(SKILL_DIMENSIONS, 1), COMMENTS)
    expect(p1).not.toBe(p2)
  })
})

// ---------------------------------------------------------------------------
// parseSkillOutput — unchanged contract
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// generateAllSkills — mock Anthropic client, no real API calls
// ---------------------------------------------------------------------------

describe('generateAllSkills', () => {
  const makeValidResponse = (name: string) =>
    JSON.stringify({ name, content: `# ${name}\nContent here.`, tags: ['tag1'] })

  it('returns one SkillOutput per dimension', async () => {
    const { generateAllSkills, SKILL_DIMENSIONS } = await import('../scripts/generate-skill.js')

    let callIndex = 0
    const mockClient = {
      messages: {
        create: vi.fn().mockImplementation(() => {
          const name = SKILL_DIMENSIONS[callIndex]?.key ?? 'fallback'
          callIndex++
          return Promise.resolve({
            content: [{ type: 'text', text: makeValidResponse(name) }],
          })
        }),
      },
    } as unknown as Anthropic

    const results = await generateAllSkills(mockClient, SKILL_DIMENSIONS, COMMENTS)
    expect(results).toHaveLength(SKILL_DIMENSIONS.length)
    expect(mockClient.messages.create).toHaveBeenCalledTimes(SKILL_DIMENSIONS.length)
  })

  it('each result has name, content, tags', async () => {
    const { generateAllSkills, SKILL_DIMENSIONS } = await import('../scripts/generate-skill.js')

    const mockClient = {
      messages: {
        create: vi.fn().mockImplementation((_params: unknown) =>
          Promise.resolve({
            content: [{ type: 'text', text: makeValidResponse('skill-name') }],
          }),
        ),
      },
    } as unknown as Anthropic

    const results = await generateAllSkills(mockClient, SKILL_DIMENSIONS, COMMENTS)
    for (const skill of results) {
      expect(typeof skill.name).toBe('string')
      expect(typeof skill.content).toBe('string')
      expect(Array.isArray(skill.tags)).toBe(true)
    }
  })

  it('works with a custom subset of dimensions', async () => {
    const { generateAllSkills, SKILL_DIMENSIONS } = await import('../scripts/generate-skill.js')

    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: makeValidResponse('x') }],
        }),
      },
    } as unknown as Anthropic

    const subset = SKILL_DIMENSIONS.slice(0, 1)
    const results = await generateAllSkills(mockClient, subset, COMMENTS)
    expect(results).toHaveLength(1)
    expect(mockClient.messages.create).toHaveBeenCalledTimes(1)
  })
})
