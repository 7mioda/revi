import 'reflect-metadata'
import { BadRequestException, Injectable, Inject } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { ConfigService } from '@nestjs/config'
import type { Model } from 'mongoose'
import { Anthropic } from '@anthropic-ai/sdk'
import type { GithubComment } from '@revi/octokit'
import { Comment } from '../me/comment.schema.js'
import { PullRequest } from '../users/pull-request.schema.js'
import { Skill } from './skill.schema.js'
import type { SkillDocument } from './skill.schema.js'
import {
  sampleRecentComments,
  generateAllSkills,
  SKILL_DIMENSIONS,
} from '../scripts/generate-skill.js'
import type { SkillOutput } from '../scripts/generate-skill.js'
import {
  buildCodingCorpus,
  createCodingRulesAgent,
  generateCodingRules,
} from '../scripts/generate-coding-rules.js'
import type { CodingRuleOutput } from '../scripts/generate-coding-rules.js'
import type { Env } from '../config.js'

export interface GenerateSkillsResult {
  generated: number
  skills: SkillOutput[]
}

export interface GenerateCodingRulesResult {
  generated: number
  rules: CodingRuleOutput[]
}

@Injectable()
export class SkillsService {
  constructor(
    @InjectModel(Comment.name) private readonly commentModel: Model<Comment>,
    @InjectModel(PullRequest.name) private readonly pullRequestModel: Model<PullRequest>,
    @InjectModel(Skill.name) private readonly skillModel: Model<SkillDocument>,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  async generate(sampleSize: number, userId?: string, username?: string): Promise<GenerateSkillsResult> {
    const query = userId ? { userId } : {}
    const rawComments = await this.commentModel.find(query).lean().exec()

    if (rawComments.length === 0) {
      throw new BadRequestException('No comments found. Run POST /me/comments first.')
    }

    const comments = rawComments as unknown as GithubComment[]
    const sample = sampleRecentComments(comments, sampleSize)

    const anthropic = new Anthropic({ apiKey: this.config.get('ANTHROPIC_API_KEY') })
    const skills = await generateAllSkills(anthropic, SKILL_DIMENSIONS, sample)

    const batchId = crypto.randomUUID()
    const generatedAt = new Date().toISOString()

    await this.skillModel.insertMany(
      skills.map((s) => ({ ...s, batchId, generatedAt, userId: userId ?? null, username: username ?? null })),
    )

    return { generated: skills.length, skills }
  }

  async generateCodingRules(userId?: string, username?: string): Promise<GenerateCodingRulesResult> {
    const commentQuery = this.buildCommentQuery(userId, username)
    const prQuery = this.buildPRQuery(userId, username)

    const [rawComments, rawPRs] = await Promise.all([
      this.commentModel.find(commentQuery).lean().exec(),
      this.pullRequestModel.find(prQuery).lean().exec(),
    ])

    if (rawComments.length === 0 && rawPRs.length === 0) {
      throw new BadRequestException(
        'No activity found for this user. Run POST /users/:username/activity or POST /me/comments first.',
      )
    }

    const corpus = buildCodingCorpus(rawPRs, rawComments)

    const agent = createCodingRulesAgent(this.config.get('ANTHROPIC_API_KEY'))
    const batchId = crypto.randomUUID()
    const generatedAt = new Date().toISOString()

    const rules = await generateCodingRules(
      agent,
      SKILL_DIMENSIONS,
      corpus,
      async (rule) => {
        await this.skillModel.create({
          ...rule,
          batchId,
          generatedAt,
          userId: userId ?? null,
          username: username ?? null,
        })
      },
    )

    return { generated: rules.length, rules }
  }

  async findByUsername(username: string): Promise<SkillDocument[]> {
    return this.skillModel.find({ username }).lean().exec()
  }

  async countGeneratedAfter(username: string, since: string): Promise<number> {
    return this.skillModel.countDocuments({ username, generatedAt: { $gt: since } })
  }

  /** Query for the `comments` collection — uses `username` for login matching. */
  private buildCommentQuery(userId?: string, username?: string): Record<string, unknown> {
    const conditions: Record<string, unknown>[] = []
    if (userId) conditions.push({ userId })
    if (username) conditions.push({ username })
    if (conditions.length === 0) return {}
    return conditions.length === 1 ? (conditions[0] ?? {}) : { $or: conditions }
  }

  /** Query for `pull_requests` — uses `authorLogin` for login matching. */
  private buildPRQuery(userId?: string, username?: string): Record<string, unknown> {
    const conditions: Record<string, unknown>[] = []
    if (userId) conditions.push({ userId })
    if (username) conditions.push({ authorLogin: username })
    if (conditions.length === 0) return {}
    return conditions.length === 1 ? (conditions[0] ?? {}) : { $or: conditions }
  }
}
