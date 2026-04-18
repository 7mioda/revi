import 'reflect-metadata'
import { BadRequestException, Injectable, Inject } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { ConfigService } from '@nestjs/config'
import type { Model } from 'mongoose'
import { Agent } from '@mastra/core/agent'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOctokitClient, fetchPRDiff } from '@revi/octokit'
import type { OctokitClient, PRFile } from '@revi/octokit'
import { Skill } from '../skills/skill.schema.js'
import type { SkillDocument } from '../skills/skill.schema.js'
import { Preference } from '../preferences/preference.schema.js'
import type { PreferenceDocument } from '../preferences/preference.schema.js'
import { Profile } from '../profiles/profile.schema.js'
import type { ProfileDocument } from '../profiles/profile.schema.js'
import {
  buildSystemPrompt,
  buildUserPrompt,
  mapToGithubReview,
  ReviewResultSchema,
} from '../scripts/review-pr.js'
import type { ReviewResult, SkillEntry, PreferenceEntry, ExistingComment, GithubReviewPayload } from '../scripts/review-pr.js'
import type { CreateReviewDto } from './dto/create-review.dto.js'
import type { Env } from '../config.js'

interface PRMeta {
  title: string
  body: string | null
  user: string
  base: string
  head: string
}


export interface ReviewResponse extends ReviewResult {
  posted: boolean
}

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Skill.name) private readonly skillModel: Model<SkillDocument>,
    @InjectModel(Preference.name) private readonly preferenceModel: Model<PreferenceDocument>,
    @InjectModel(Profile.name) private readonly profileModel: Model<ProfileDocument>,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  async review(dto: CreateReviewDto): Promise<ReviewResponse> {
    console.log('review dto', JSON.stringify(dto, null, 2))
    const query = this.buildSkillQuery(dto.userId, dto.username)

    const [skillDocs, prefDocs] = await Promise.all([
      this.skillModel.find(query).lean().exec(),
      this.preferenceModel.find(query).lean().exec(),
    ])

    if (skillDocs.length === 0) {
      throw new BadRequestException('No skills found. Run POST /skills or POST /skills/coding-rules first.')
    }

    const skills: SkillEntry[] = skillDocs.map((s) => ({
      name: s.name,
      content: s.content,
      tags: s.tags,
    }))

    const preferences: PreferenceEntry[] = prefDocs.map((p) => ({
      name: p.name,
      dimension: p.dimension,
      content: p.content,
    }))

    // Build the agent's identity from the user's skills and preferences
    const systemPrompt = buildSystemPrompt(skills, preferences)
    const agent = new Agent({
      id: 'code-reviewer',
      name: 'code-reviewer',
      instructions: systemPrompt,
      model: createAnthropic({ apiKey: this.config.get('ANTHROPIC_API_KEY') })('claude-sonnet-4-6'),
    })

    const githubToken = this.config.get('GITHUB_TOKEN')
    const client = createOctokitClient(githubToken)

    const [meta, files, existingComments] = await Promise.all([
      this.fetchPRMeta(client, dto.owner, dto.repo, dto.pullNumber),
      fetchPRDiff(client, dto.owner, dto.repo, dto.pullNumber),
      this.fetchExistingComments(client, dto.owner, dto.repo, dto.pullNumber),
    ])

    const userPrompt = buildUserPrompt(meta, files, existingComments, skills)

    const { object: result } = await agent.generate(userPrompt, {
      structuredOutput: { schema: ReviewResultSchema },
    })

    const shouldPost = dto.post !== false
    if (shouldPost) {
      const payload = mapToGithubReview(result)
      await this.postReview(client, dto.owner, dto.repo, dto.pullNumber, payload)
    }

    const profileLogin = dto.username ?? dto.userId
    if (profileLogin) {
      void this.profileModel
        .updateOne({ username: profileLogin }, { $inc: { reviews: 1 } })
        .exec()
    }

    return { ...result, posted: shouldPost }
  }

  /** Returns a MongoDB query matching skills by userId and/or username. */
  private buildSkillQuery(userId?: string, username?: string): Record<string, unknown> {
    const conditions: Record<string, unknown>[] = []
    if (userId) conditions.push({ userId })
    if (username) conditions.push({ username })
    if (conditions.length === 0) return {}
    return conditions.length === 1 ? (conditions[0] ?? {}) : { $or: conditions }
  }

  private async fetchPRMeta(
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
