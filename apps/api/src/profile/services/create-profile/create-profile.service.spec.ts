import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConfigService } from '@nestjs/config'
import { CreateProfileService } from './create-profile.service.js'
import {
  ProfileRepositoryInMemory,
  IssueRepositoryInMemory,
  PullRequestRepositoryInMemory,
  CommentRepositoryInMemory,
  DiscussionRepositoryInMemory,
  ProfileJobRepositoryInMemory,
  PreferenceRepositoryInMemory,
  SkillRepositoryInMemory,
} from '../../infrastructure/persistence/index.js'

vi.mock('@revi/octokit', () => ({
  createOctokitClient: vi.fn(() => ({})),
  fetchUserIssues: vi.fn(async () => []),
  fetchUserPullRequests: vi.fn(async () => []),
  fetchUserDiscussions: vi.fn(async () => []),
  searchReposWithCommenter: vi.fn(async () => []),
  fetchAllComments: vi.fn(async () => []),
  getGithubUser: vi.fn(async () => ({
    login: 'alice',
    githubId: 1,
    avatarUrl: null,
    name: 'Alice',
    bio: null,
    company: null,
    location: null,
    email: null,
    blog: null,
    twitterUsername: null,
    followers: 0,
    following: 0,
    publicRepos: 0,
    githubCreatedAt: '2020-01-01T00:00:00Z',
  })),
}))

vi.mock('../../../scripts/generate-preference.js', () => ({
  buildCorpus: vi.fn(() => []),
  bucketByTime: vi.fn(() => []),
  createPreferenceAgent: vi.fn(() => ({})),
  generatePreferences: vi.fn(async () => []),
  PREFERENCE_DIMENSIONS: [],
}))

vi.mock('../../../scripts/generate-coding-rules.js', () => ({
  buildCodingCorpus: vi.fn(() => []),
  chunkCorpusTimed: vi.fn(() => []),
  buildExtractPrompt: vi.fn(() => ''),
  buildMergePrompt: vi.fn(() => ''),
  createCodingRulesAgent: vi.fn(() => ({})),
  CodingRuleOutputSchema: {},
  CHUNK_SIZE: 5000,
}))

vi.mock('../../../scripts/generate-skill.js', () => ({
  SKILL_DIMENSIONS: [],
}))

function buildService() {
  const config = {
    get: (_key: string) => 'test-value',
  } as unknown as ConfigService<Record<string, unknown>, true>

  return new CreateProfileService(
    new ProfileRepositoryInMemory(),
    new IssueRepositoryInMemory(),
    new PullRequestRepositoryInMemory(),
    new CommentRepositoryInMemory(),
    new DiscussionRepositoryInMemory(),
    new ProfileJobRepositoryInMemory(),
    new PreferenceRepositoryInMemory(),
    new SkillRepositoryInMemory(),
    config,
  )
}

describe('CreateProfileService', () => {
  it('returns a jobId immediately', async () => {
    const svc = buildService()
    const result = await svc.execute({ username: 'alice' })
    expect(result.jobId).toBeTruthy()
  })

  it('returns the same jobId on retry', async () => {
    const svc = buildService()
    const { jobId } = await svc.execute({ username: 'alice' })
    const retried = await svc.execute({ username: 'alice', existingJobId: jobId })
    expect(retried.jobId).toBe(jobId)
  })

  it('throws when existingJobId does not exist', async () => {
    const svc = buildService()
    await expect(svc.execute({ username: 'alice', existingJobId: 'bad-id' })).rejects.toThrow('not found')
  })
})
