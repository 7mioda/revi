import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Agent } from '@mastra/core/agent'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOctokitClient, fetchPRDiff } from '@revi/octokit'
import type { OctokitClient, PRFile } from '@revi/octokit'
import {
  buildSystemPrompt,
  buildUserPrompt,
  mapToGithubReview,
  ReviewResultSchema,
} from '../../../scripts/review-pr.js'
import type { ReviewResult, SkillEntry, PreferenceEntry, ExistingComment, GithubReviewPayload } from '../../../scripts/review-pr.js'
import {
  buildCorpus,
  bucketByTime,
  createPreferenceAgent,
  generatePreferences,
  PREFERENCE_DIMENSIONS,
} from '../../../scripts/generate-preference.js'
import {
  ProfileRepository,
  SkillRepository,
  PreferenceRepository,
  CommentRepository,
  IssueRepository,
  PullRequestRepository,
} from '../../infrastructure/persistence/index.js'
import type { Env } from '../../../config.js'

export interface RunReviewInput {
  profileId: string
  owner: string
  repo: string
  pullNumber: number
  post?: boolean
}

export interface RunReviewOutput extends ReviewResult {
  posted: boolean
}

export interface GeneratePreferencesInput {
  profileId: string
}

export interface GeneratePreferencesOutput {
  generated: number
}

interface PRMeta {
  title: string
  body: string | null
  user: string
  base: string
  head: string
}

@Injectable()
export class UpdateProfileService {
  constructor(
    @Inject(ProfileRepository) private readonly profileRepo: ProfileRepository,
    @Inject(SkillRepository) private readonly skillRepo: SkillRepository,
    @Inject(PreferenceRepository) private readonly preferenceRepo: PreferenceRepository,
    @Inject(CommentRepository) private readonly commentRepo: CommentRepository,
    @Inject(IssueRepository) private readonly issueRepo: IssueRepository,
    @Inject(PullRequestRepository) private readonly prRepo: PullRequestRepository,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  async runReview({ profileId, owner, repo, pullNumber, post }: RunReviewInput): Promise<RunReviewOutput> {
    const profile = await this.profileRepo.findById(profileId)
    if (!profile) throw new NotFoundException(`Profile ${profileId} not found`)

    const [skills, preferences] = await Promise.all([
      this.skillRepo.findByUsername(profile.username),
      this.preferenceRepo.findByUsername(profile.username),
    ])

    if (skills.length === 0) {
      throw new BadRequestException('No skills found. Run profile sync first.')
    }

    const skillEntries: SkillEntry[] = skills.map((s) => ({
      name: s.name,
      content: s.content,
      tags: s.tags,
    }))

    const preferenceEntries: PreferenceEntry[] = preferences.map((p) => ({
      name: p.name,
      dimension: p.dimension,
      content: p.content,
    }))

    const systemPrompt = buildSystemPrompt(skillEntries, preferenceEntries)
    const agent = new Agent({
      id: 'code-reviewer',
      name: 'code-reviewer',
      instructions: systemPrompt,
      model: createAnthropic({ apiKey: this.config.get('ANTHROPIC_API_KEY') })('claude-sonnet-4-6'),
    })

    const client = createOctokitClient(this.config.get('GITHUB_TOKEN'))
    const [meta, files, existingComments] = await Promise.all([
      this.fetchPRMeta(client, owner, repo, pullNumber),
      fetchPRDiff(client, owner, repo, pullNumber),
      this.fetchExistingComments(client, owner, repo, pullNumber),
    ])

    const userPrompt = buildUserPrompt(meta, files, existingComments, skillEntries)
    const { object: result } = await agent.generate(userPrompt, {
      structuredOutput: { schema: ReviewResultSchema },
    })

    const shouldPost = post !== false
    if (shouldPost) {
      const payload = mapToGithubReview(result)
      await this.postReview(client, owner, repo, pullNumber, payload)
    }

    void this.profileRepo.incrementReviews(profileId)

    return { ...result, posted: shouldPost }
  }

  async generatePreferences({ profileId }: GeneratePreferencesInput): Promise<GeneratePreferencesOutput> {
    const profile = await this.profileRepo.findById(profileId)
    if (!profile) throw new NotFoundException(`Profile ${profileId} not found`)

    const [rawComments, rawIssues, rawPRs] = await Promise.all([
      this.commentRepo.findByUsername(profile.username),
      this.issueRepo.findByUsername(profile.username),
      this.prRepo.findByUsername(profile.username),
    ])

    if (rawComments.length === 0 && rawIssues.length === 0 && rawPRs.length === 0) {
      throw new BadRequestException('No activity found for this profile.')
    }

    const corpus = buildCorpus(rawComments as never, rawIssues as never, rawPRs as never)
    const buckets = bucketByTime(corpus)
    const agent = createPreferenceAgent(this.config.get('ANTHROPIC_API_KEY'))
    const batchId = crypto.randomUUID()
    const generatedAt = new Date().toISOString()

    const prefs = await generatePreferences(agent, PREFERENCE_DIMENSIONS, buckets, async (preference) => {
      await this.preferenceRepo.save({
        ...preference,
        batchId,
        generatedAt,
        userId: null,
        username: profile.username,
      })
    })

    return { generated: prefs.length }
  }

  private async fetchPRMeta(client: OctokitClient, owner: string, repo: string, pullNumber: number): Promise<PRMeta> {
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

  private async fetchExistingComments(
    client: OctokitClient,
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<ExistingComment[]> {
    const { data } = await client.request(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}/comments',
      { owner, repo, pull_number: pullNumber, per_page: 100 },
    )
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

  private async postReview(
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
      event: payload.event as 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
      comments: newComments.map((c) => ({
        path: c.path!,
        line: c.line!,
        side: c.side as 'LEFT' | 'RIGHT',
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
}
