import { BadRequestException, Injectable, Inject } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { ConfigService } from '@nestjs/config'
import type { Model } from 'mongoose'
import { Comment } from '../me/comment.schema.js'
import { Issue } from '../users/issue.schema.js'
import { PullRequest } from '../users/pull-request.schema.js'
import { Preference } from './preference.schema.js'
import type { PreferenceDocument } from './preference.schema.js'
import {
  buildCorpus,
  bucketByTime,
  createPreferenceAgent,
  generatePreferences,
  PREFERENCE_DIMENSIONS,
} from '../scripts/generate-preference.js'
import type { PreferenceOutput } from '../scripts/generate-preference.js'
import type { Env } from '../config.js'

export interface GeneratePreferencesResult {
  generated: number
  preferences: PreferenceOutput[]
}

@Injectable()
export class PreferencesService {
  constructor(
    @InjectModel(Comment.name) private readonly commentModel: Model<Comment>,
    @InjectModel(Issue.name) private readonly issueModel: Model<Issue>,
    @InjectModel(PullRequest.name) private readonly pullRequestModel: Model<PullRequest>,
    @InjectModel(Preference.name) private readonly preferenceModel: Model<PreferenceDocument>,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  async generate(userId?: string, username?: string): Promise<GeneratePreferencesResult> {
    // Build collection-specific queries — field names differ per schema.
    const commentQuery = this.buildCommentQuery(userId, username)
    const activityQuery = this.buildActivityQuery(userId, username)

    const [rawComments, rawIssues, rawPRs] = await Promise.all([
      this.commentModel.find(commentQuery).lean().exec(),
      this.issueModel.find(activityQuery).lean().exec(),
      this.pullRequestModel.find(activityQuery).lean().exec(),
    ])

    if (rawComments.length === 0 && rawIssues.length === 0 && rawPRs.length === 0) {
      throw new BadRequestException(
        'No activity found for this user. Run POST /users/:username/activity or POST /me/comments first.',
      )
    }

    const corpus = buildCorpus(rawComments, rawIssues, rawPRs)
    const buckets = bucketByTime(corpus)

    const agent = createPreferenceAgent(this.config.get('ANTHROPIC_API_KEY'))
    const batchId = crypto.randomUUID()
    const generatedAt = new Date().toISOString()

    const preferences = await generatePreferences(
      agent,
      PREFERENCE_DIMENSIONS,
      buckets,
      async (preference) => {
        await this.preferenceModel.create({
          ...preference,
          batchId,
          generatedAt,
          userId: userId ?? null,
          username: username ?? null,
        })
      },
    )

    return { generated: preferences.length, preferences }
  }

  async findByUsername(username: string): Promise<PreferenceDocument[]> {
    return this.preferenceModel.find({ username }).lean().exec()
  }

  /** Query for the `comments` collection — uses `username` for login matching. */
  private buildCommentQuery(userId?: string, username?: string): Record<string, unknown> {
    const conditions: Record<string, unknown>[] = []
    if (userId) conditions.push({ userId })
    if (username) conditions.push({ username })
    return conditions.length === 1 ? (conditions[0] ?? {}) : { $or: conditions }
  }

  /** Query for `issues` and `pull_requests` — uses `authorLogin` for login matching. */
  private buildActivityQuery(userId?: string, username?: string): Record<string, unknown> {
    const conditions: Record<string, unknown>[] = []
    if (userId) conditions.push({ userId })
    if (username) conditions.push({ authorLogin: username })
    return conditions.length === 1 ? (conditions[0] ?? {}) : { $or: conditions }
  }
}
