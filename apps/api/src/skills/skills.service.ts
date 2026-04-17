import 'reflect-metadata'
import { BadRequestException, Injectable, Inject } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { ConfigService } from '@nestjs/config'
import type { Model } from 'mongoose'
import { Anthropic } from '@anthropic-ai/sdk'
import type { GithubComment } from '@revi/octokit'
import { Comment } from '../me/comment.schema.js'
import { Skill } from './skill.schema.js'
import type { SkillDocument } from './skill.schema.js'
import {
  sampleRecentComments,
  generateAllSkills,
  SKILL_DIMENSIONS,
} from '../scripts/generate-skill.js'
import type { SkillOutput } from '../scripts/generate-skill.js'
import type { Env } from '../config.js'

export interface GenerateSkillsResult {
  generated: number
  skills: SkillOutput[]
}

@Injectable()
export class SkillsService {
  constructor(
    @InjectModel(Comment.name) private readonly commentModel: Model<Comment>,
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
}
