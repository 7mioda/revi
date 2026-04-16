import 'reflect-metadata'
import { BadRequestException, Injectable, Inject } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { ConfigService } from '@nestjs/config'
import type { Model } from 'mongoose'
import Anthropic from '@anthropic-ai/sdk'
import { createOctokitClient } from '@revi/octokit'
import type { OctokitClient } from '@revi/octokit'
import { Skill } from '../skills/skill.schema.js'
import type { SkillDocument } from '../skills/skill.schema.js'
import {
  buildUserPrompt,
  parseReviewResult,
  mapToGithubReview,
} from '../scripts/review-pr.js'
import type { ReviewResult, SkillEntry } from '../scripts/review-pr.js'
import type { CreateReviewDto } from './dto/create-review.dto.js'
import type { Env } from '../config.js'

interface PRMeta {
  title: string
  body: string | null
  user: string
  base: string
  head: string
}

interface PRFile {
  filename: string
  status: string
  patch?: string
}

interface ExistingComment {
  path: string
  line: number
  body: string
}

export interface ReviewResponse extends ReviewResult {
  posted: boolean
}

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Skill.name) private readonly skillModel: Model<SkillDocument>,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  async review(dto: CreateReviewDto): Promise<ReviewResponse> {
    const latest = await this.skillModel.findOne().sort({ generatedAt: -1 }).lean().exec()
    if (latest === null) {
      throw new BadRequestException('No skills found. Run POST /skills first.')
    }
    const skillDocs = await this.skillModel.find({ batchId: latest.batchId }).lean().exec()
    const skills: SkillEntry[] = skillDocs.map((s) => ({
      name: s.name,
      content: s.content,
      tags: s.tags,
    }))

    const systemPrompt = skills.map((s) => s.content).join('\n\n---\n\n')

    const githubToken = this.config.get('GITHUB_TOKEN')
    const client = createOctokitClient(githubToken)

    const [meta, files, existingComments] = await Promise.all([
      this.fetchPRMeta(client, dto.owner, dto.repo, dto.pullNumber),
      this.fetchPRFiles(client, dto.owner, dto.repo, dto.pullNumber),
      this.fetchExistingComments(client, dto.owner, dto.repo, dto.pullNumber),
    ])

    const userPrompt = buildUserPrompt(meta, files, existingComments, skills)

    const anthropic = new Anthropic({ apiKey: this.config.get('ANTHROPIC_API_KEY') })
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

    const result = parseReviewResult(responseText)

    const shouldPost = dto.post !== false
    if (shouldPost) {
      const payload = mapToGithubReview(result)
      await this.postReview(client, dto.owner, dto.repo, dto.pullNumber, payload)
    }

    return { ...result, posted: shouldPost }
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

  private async fetchPRFiles(
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
    payload: { body: string; event: string; comments: Array<{ path: string; line: number; side: string; body: string }> },
  ): Promise<void> {
    await client.request('POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
      owner,
      repo,
      pull_number: pullNumber,
      body: payload.body,
      event: payload.event as 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
      comments: payload.comments.map((c) => ({
        path: c.path,
        line: c.line,
        side: c.side as 'LEFT' | 'RIGHT',
        body: c.body,
      })),
    })
  }
}
