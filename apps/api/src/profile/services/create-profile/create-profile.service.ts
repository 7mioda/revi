import { Injectable, Inject, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import pLimit from 'p-limit'
import { put } from '@vercel/blob'
import { pixelize } from '@revi/pixel'
import {
  createOctokitClient,
  fetchUserIssues,
  fetchUserPullRequests,
  fetchPRDiff,
  searchReposWithCommenter,
  fetchAllComments,
  fetchUserDiscussions,
  getGithubUser,
} from '@revi/octokit'
import type { GithubIssue, GithubComment } from '@revi/octokit'
import { Anthropic } from '@anthropic-ai/sdk'
import pLimit_ from 'p-limit'
import {
  buildCorpus,
  bucketByTime,
  createPreferenceAgent,
  generatePreferences,
  PREFERENCE_DIMENSIONS,
} from '../../../scripts/generate-preference.js'
import {
  buildCodingCorpus,
  chunkCorpusTimed,
  buildExtractPrompt,
  buildMergePrompt,
  createCodingRulesAgent,
  CodingRuleOutputSchema,
  CHUNK_SIZE,
} from '../../../scripts/generate-coding-rules.js'
import type { TimedChunkRules } from '../../../scripts/generate-coding-rules.js'
import { SKILL_DIMENSIONS } from '../../../scripts/generate-skill.js'
import {
  ProfileRepository,
  IssueRepository,
  PullRequestRepository,
  CommentRepository,
  DiscussionRepository,
  ProfileJobRepository,
  PreferenceRepository,
  SkillRepository,
} from '../../infrastructure/persistence/index.js'
import type { Env } from '../../../config.js'

export interface CreateProfileInput {
  /** Required for new jobs. For retries, can be omitted if profileId is given. */
  username?: string
  /** MongoDB ObjectId of an existing Profile — used in retry to look up username. */
  profileId?: string
  token?: string
  existingJobId?: string
}

export interface CreateProfileOutput {
  jobId: string
}

@Injectable()
export class CreateProfileService {
  private readonly logger = new Logger(CreateProfileService.name)

  constructor(
    @Inject(ProfileRepository) private readonly profileRepo: ProfileRepository,
    @Inject(IssueRepository) private readonly issueRepo: IssueRepository,
    @Inject(PullRequestRepository) private readonly prRepo: PullRequestRepository,
    @Inject(CommentRepository) private readonly commentRepo: CommentRepository,
    @Inject(DiscussionRepository) private readonly discussionRepo: DiscussionRepository,
    @Inject(ProfileJobRepository) private readonly jobRepo: ProfileJobRepository,
    @Inject(PreferenceRepository) private readonly preferenceRepo: PreferenceRepository,
    @Inject(SkillRepository) private readonly skillRepo: SkillRepository,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  async execute({ username, profileId, token, existingJobId }: CreateProfileInput): Promise<CreateProfileOutput> {
    let resolvedUsername: string

    if (username) {
      resolvedUsername = username
    } else if (profileId) {
      const profile = await this.profileRepo.findById(profileId)
      if (!profile) throw new Error(`Profile ${profileId} not found`)
      resolvedUsername = profile.username
    } else {
      throw new Error('username or profileId is required')
    }

    let jobId: string

    if (existingJobId) {
      const existing = await this.jobRepo.findById(existingJobId)
      if (!existing) throw new Error(`Job ${existingJobId} not found`)
      jobId = existingJobId
    } else {
      const job = await this.jobRepo.create(resolvedUsername)
      jobId = job.id
    }

    void this.runPipeline(jobId, resolvedUsername, token)
    return { jobId }
  }

  private async runPipeline(jobId: string, username: string, token?: string): Promise<void> {
    await this.jobRepo.markRunning(jobId)

    try {
      const effectiveToken = token ?? this.config.get('GITHUB_TOKEN')
      const client = createOctokitClient(effectiveToken)

      const job = await this.jobRepo.findById(jobId)
      if (!job) throw new Error(`Job ${jobId} not found`)
      const stepDone = (name: string) => job.steps.find((s) => s.name === name)?.status === 'done'

      // ── Step 1: fetchActivity ─────────────────────────────────────────────
      if (!stepDone('fetchActivity')) {
        await this.jobRepo.updateStep(jobId, 'fetchActivity', 'running')

        const [githubUser, issues, prs, discussions, commentRepos] = await Promise.all([
          getGithubUser(client, username),
          fetchUserIssues(client, username),
          fetchUserPullRequests(client, username),
          fetchUserDiscussions(client, username),
          searchReposWithCommenter(client, username),
        ])

        // Upsert GitHub profile
        const profile = await this.profileRepo.upsert({
          username: githubUser.login,
          githubId: githubUser.githubId,
          avatarUrl: githubUser.avatarUrl,
          name: githubUser.name,
          bio: githubUser.bio,
          company: githubUser.company,
          location: githubUser.location,
          email: githubUser.email,
          blog: githubUser.blog,
          twitterUsername: githubUser.twitterUsername,
          followers: githubUser.followers,
          following: githubUser.following,
          publicRepos: githubUser.publicRepos,
          githubCreatedAt: githubUser.githubCreatedAt,
          syncedAt: new Date().toISOString(),
          reviews: 0,
          avatar: null,
        })

        // Pixelize avatar
        if (githubUser.avatarUrl) {
          try {
            const avatarBlobUrl = await this.pixelizeAndUploadAvatar(githubUser.avatarUrl, username)
            if (avatarBlobUrl) {
              await this.profileRepo.update(profile.id, { avatar: avatarBlobUrl })
            }
          } catch (err) {
            this.logger.warn(`Avatar pixelization skipped for ${username}: ${err}`)
          }
        }

        // Upsert issues
        await Promise.all(issues.map((issue: GithubIssue) =>
          this.issueRepo.upsert({ ...issue, userId: null }),
        ))

        // Upsert PRs with diffs
        const prLimit = pLimit(5)
        await Promise.all(prs.map((pr) => prLimit(async () => {
          let files: Array<{ filename: string; status: string; patch?: string }> = []
          try {
            files = await fetchPRDiff(client, pr.repoOwner, pr.repoName, pr.number)
          } catch (err: unknown) {
            const status = typeof err === 'object' && err !== null && 'status' in err
              ? (err as { status: number }).status
              : 'unknown'
            this.logger.warn(`Skipping diff for ${pr.repoOwner}/${pr.repoName}#${pr.number} — HTTP ${status}`)
          }
          await this.prRepo.upsert({ ...pr, files, userId: null })
        })))

        // Upsert discussions
        await Promise.all(discussions.map((d) =>
          this.discussionRepo.upsert({ ...d, username, userId: null }),
        ))

        // Fetch and upsert comments
        const commentLimit = pLimit(5)
        const commentResults = await Promise.all(
          commentRepos.map((repo) => commentLimit(() => this.fetchAndSaveComments(client, repo, username))),
        )
        const commentCount = commentResults.reduce((sum, n) => sum + n, 0)

        const total = issues.length + prs.length + discussions.length + commentCount
        await this.jobRepo.updateStep(jobId, 'fetchActivity', 'done', total)
        this.logger.log(`Step 1 done: ${issues.length} issues, ${prs.length} PRs, ${discussions.length} discussions, ${commentCount} comments for ${username}`)
      }

      // ── Step 2: generatePreferences ──────────────────────────────────────
      if (!stepDone('generatePreferences')) {
        await this.jobRepo.updateStep(jobId, 'generatePreferences', 'running')
        const generated = await this.generatePreferences(username)
        await this.jobRepo.updateStep(jobId, 'generatePreferences', 'done', generated)
        this.logger.log(`Step 2 done: ${generated} preferences for ${username}`)
      }

      // ── Step 3: generateCodingRules ───────────────────────────────────────
      if (!stepDone('generateCodingRules')) {
        await this.jobRepo.updateStep(jobId, 'generateCodingRules', 'running')
        const generated = await this.generateCodingRules(username, async (done) => {
          await this.jobRepo.updateStep(jobId, 'generateCodingRules', 'running', done)
        })
        await this.jobRepo.updateStep(jobId, 'generateCodingRules', 'done', generated)
        this.logger.log(`Step 3 done: ${generated} coding rules for ${username}`)
      }

      await this.jobRepo.markDone(jobId)
      this.logger.log(`Profile sync job ${jobId} completed for ${username}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      await this.jobRepo.markFailed(jobId, msg)
      this.logger.error(`Profile sync job ${jobId} failed: ${msg}`)
    }
  }

  private async generatePreferences(username: string): Promise<number> {
    const [rawComments, rawIssues, rawPRs] = await Promise.all([
      this.commentRepo.findByUsername(username),
      this.issueRepo.findByUsername(username),
      this.prRepo.findByUsername(username),
    ])

    if (rawComments.length === 0 && rawIssues.length === 0 && rawPRs.length === 0) {
      this.logger.warn(`No activity for preferences generation for ${username}`)
      return 0
    }

    const corpus = buildCorpus(rawComments as never, rawIssues as never, rawPRs as never)
    const buckets = bucketByTime(corpus)
    const agent = createPreferenceAgent(this.config.get('ANTHROPIC_API_KEY'))
    const batchId = crypto.randomUUID()
    const generatedAt = new Date().toISOString()

    const preferences = await generatePreferences(agent, PREFERENCE_DIMENSIONS, buckets, async (preference) => {
      await this.preferenceRepo.save({
        ...preference,
        batchId,
        generatedAt,
        userId: null,
        username,
      })
    })

    return preferences.length
  }

  private async generateCodingRules(
    username: string,
    onProgress?: (completed: number) => Promise<void>,
  ): Promise<number> {
    const [rawComments, rawPRs] = await Promise.all([
      this.commentRepo.findByUsername(username),
      this.prRepo.findByUsername(username),
    ])

    if (rawComments.length === 0 && rawPRs.length === 0) {
      this.logger.warn(`No activity for coding rules generation for ${username}`)
      return 0
    }

    const corpus = buildCodingCorpus(rawPRs as never, rawComments as never)
    const timedChunks = chunkCorpusTimed(corpus, CHUNK_SIZE)

    if (timedChunks.length === 0) return 0

    const agent = createCodingRulesAgent(this.config.get('ANTHROPIC_API_KEY'))
    const batchId = crypto.randomUUID()
    const generatedAt = new Date().toISOString()
    const limit = pLimit_(5)
    let completed = 0
    let totalGenerated = 0

    for (const dimension of SKILL_DIMENSIONS) {
      const chunkResults: TimedChunkRules[] = (
        await Promise.all(
          timedChunks.map((chunk) =>
            limit(async () => {
              try {
                const { object } = await agent.generate(
                  buildExtractPrompt(dimension, chunk),
                  { structuredOutput: { schema: CodingRuleOutputSchema } },
                )
                await this.skillRepo.upsertByDimension({
                  name: object.name,
                  content: object.content,
                  tags: object.tags,
                  batchId,
                  generatedAt,
                  userId: null,
                  username,
                  dimension: dimension.key,
                })
                return { rules: object, from: chunk.from, to: chunk.to, index: chunk.index }
              } catch (err) {
                this.logger.warn(`Chunk ${chunk.index + 1}/${timedChunks.length} failed for dimension ${dimension.key}: ${String(err)}`)
                return null
              }
            }),
          ),
        )
      ).filter((r): r is TimedChunkRules => r !== null)

      if (chunkResults.length === 0) {
        this.logger.warn(`No successful chunks for dimension ${dimension.key}, skipping`)
        completed++
        await onProgress?.(completed)
        continue
      }

      let final = chunkResults[chunkResults.length - 1]!.rules
      if (chunkResults.length > 1) {
        try {
          const { object } = await agent.generate(
            buildMergePrompt(dimension, chunkResults),
            { structuredOutput: { schema: CodingRuleOutputSchema } },
          )
          final = object
        } catch (err) {
          this.logger.warn(`Merge failed for dimension ${dimension.key}: ${String(err)}`)
        }
      }

      await this.skillRepo.upsertByDimension({
        name: final.name,
        content: final.content,
        tags: final.tags,
        batchId,
        generatedAt,
        userId: null,
        username,
        dimension: dimension.key,
      })

      totalGenerated++
      completed++
      await onProgress?.(completed)
    }

    return totalGenerated
  }

  private async pixelizeAndUploadAvatar(avatarUrl: string, username: string): Promise<string | null> {
    const token = this.config.get('BLOB_READ_WRITE_TOKEN', { infer: true })
    if (!token) return null

    const res = await fetch(avatarUrl)
    if (!res.ok) return null
    const inputBuf = Buffer.from(await res.arrayBuffer())
    const pixelized = await pixelize(inputBuf, { scale: 12 })
    const { url } = await put(`avatars/${username}.png`, pixelized, { access: 'public', token, contentType: 'image/png' })
    return url
  }

  private async fetchAndSaveComments(
    client: Parameters<typeof fetchAllComments>[0],
    repo: { owner: string; name: string },
    username: string,
  ): Promise<number> {
    try {
      const all = await fetchAllComments(client, repo.owner, repo.name)
      const mine = all.filter((c: GithubComment) => c.username === username)
      await Promise.all(mine.map((c: GithubComment) =>
        this.commentRepo.upsert({ ...c, userId: null }),
      ))
      return mine.length
    } catch (err: unknown) {
      const status = typeof err === 'object' && err !== null && 'status' in err
        ? (err as { status: number }).status
        : 'unknown'
      this.logger.warn(`Skipping ${repo.owner}/${repo.name} — HTTP ${status}`)
      return 0
    }
  }
}
