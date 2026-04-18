import 'reflect-metadata'
import { Injectable, Inject, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { ConfigService } from '@nestjs/config'
import type { Model } from 'mongoose'
import pLimit from 'p-limit'
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
import type { GithubIssue } from '@revi/octokit'
import { Issue } from '../users/issue.schema.js'
import { PullRequest } from '../users/pull-request.schema.js'
import { Comment } from '../me/comment.schema.js'
import { Discussion } from '../users/discussion.schema.js'
import { Profile } from './profile.schema.js'
import type { ProfileDocument } from './profile.schema.js'
import { ProfileSyncJob } from './profile-sync-job.schema.js'
import { ProfileJobsService } from './profile-jobs.service.js'
import { PreferencesService } from '../preferences/preferences.service.js'
import { SkillsService } from '../skills/skills.service.js'
import { NovuService } from '../novu/novu.service.js'
import type { Env } from '../config.js'

@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name)

  constructor(
    @InjectModel(Issue.name) private readonly issueModel: Model<Issue>,
    @InjectModel(PullRequest.name) private readonly prModel: Model<PullRequest>,
    @InjectModel(Comment.name) private readonly commentModel: Model<Comment>,
    @InjectModel(Discussion.name) private readonly discussionModel: Model<Discussion>,
    @InjectModel(Profile.name) private readonly profileModel: Model<ProfileDocument>,
    @InjectModel(ProfileSyncJob.name) private readonly syncJobModel: Model<ProfileSyncJob>,
    @Inject(ProfileJobsService) private readonly jobsService: ProfileJobsService,
    @Inject(PreferencesService) private readonly preferencesService: PreferencesService,
    @Inject(SkillsService) private readonly skillsService: SkillsService,
    @Inject(NovuService) private readonly novuService: NovuService,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Creates (or retries) a 3-step profile sync job for `username`.
   * Returns the jobId immediately; execution runs in the background.
   */
  async sync(username: string, token?: string, existingJobId?: string): Promise<string> {
    let jobId: string

    if (existingJobId) {
      const existing = await this.jobsService.findById(existingJobId)
      if (!existing) throw new Error(`Job ${existingJobId} not found`)
      jobId = existingJobId
    } else {
      const job = await this.jobsService.create(username)
      jobId = String((job as unknown as { _id: { toString(): string } })._id)
    }

    // Fire-and-forget — caller gets jobId immediately
    void this.runPipeline(jobId, username, token)
    return jobId
  }

  private async runPipeline(jobId: string, username: string, token?: string): Promise<void> {
    await this.jobsService.markRunning(jobId)

    try {
      const effectiveToken = token ?? this.config.get('GITHUB_TOKEN')
      const client = createOctokitClient(effectiveToken)

      // Reload job to check which steps are already done (retry support)
      const job = await this.jobsService.findById(jobId)
      if (!job) throw new Error(`Job ${jobId} not found`)

      const stepDone = (name: string) => job.steps.find((s) => s.name === name)?.status === 'done'

      // ── Step 1: fetchActivity ─────────────────────────────────────────────
      if (!stepDone('fetchActivity')) {
        await this.jobsService.updateStep(jobId, 'fetchActivity', 'running')

        // Fetch GitHub profile metadata + all activity in parallel
        const [githubUser, issues, prs, discussions, commentRepos] = await Promise.all([
          getGithubUser(client, username),
          fetchUserIssues(client, username),
          fetchUserPullRequests(client, username),
          fetchUserDiscussions(client, username),
          searchReposWithCommenter(client, username),
        ])

        // Upsert GitHub profile
        await this.profileModel.findOneAndUpdate(
          { username: githubUser.login },
          { ...githubUser, username: githubUser.login, syncedAt: new Date().toISOString() },
          { upsert: true, new: true },
        ).exec()

        // Upsert issues
        await Promise.all(issues.map((issue: GithubIssue) =>
          this.issueModel.findOneAndUpdate(
            { githubId: issue.githubId },
            { ...issue, authorLogin: issue.authorLogin, username },
            { upsert: true, new: true },
          ).exec(),
        ))

        // Upsert PRs with diffs (p-limit 5)
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
          await this.prModel.findOneAndUpdate(
            { githubId: pr.githubId },
            { ...pr, username, files },
            { upsert: true, new: true },
          ).exec()
        })))

        // Upsert discussions
        await Promise.all(discussions.map((d) =>
          this.discussionModel.findOneAndUpdate(
            { githubId: d.githubId },
            { ...d, username, userId: null },
            { upsert: true, new: true },
          ).exec(),
        ))

        // Fetch and upsert comments (p-limit 5)
        const commentLimit = pLimit(5)
        const commentResults = await Promise.all(
          commentRepos.map((repo) => commentLimit(() => this.fetchAndSaveComments(client, repo, username))),
        )
        const commentCount = commentResults.reduce((sum, n) => sum + n, 0)

        const total = issues.length + prs.length + discussions.length + commentCount
        await this.jobsService.updateStep(jobId, 'fetchActivity', 'done', total)
        this.logger.log(`Step 1 done: ${issues.length} issues, ${prs.length} PRs, ${discussions.length} discussions, ${commentCount} comments for ${username}`)
      }

      // ── Step 2: generatePreferences ──────────────────────────────────────
      if (!stepDone('generatePreferences')) {
        await this.jobsService.updateStep(jobId, 'generatePreferences', 'running')
        const result = await this.preferencesService.generate(undefined, username)
        await this.jobsService.updateStep(jobId, 'generatePreferences', 'done', result.generated)
        this.logger.log(`Step 2 done: ${result.generated} preferences for ${username}`)
      }

      // ── Step 3: generateCodingRules ───────────────────────────────────────
      if (!stepDone('generateCodingRules')) {
        await this.jobsService.updateStep(jobId, 'generateCodingRules', 'running')
        const result = await this.skillsService.generateCodingRules(undefined, username)
        await this.jobsService.updateStep(jobId, 'generateCodingRules', 'done', result.generated)
        this.logger.log(`Step 3 done: ${result.generated} coding rules for ${username}`)
      }

      await this.jobsService.markDone(jobId)
      void this.novuService.notifyProfileSyncDone(username, jobId)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      await this.jobsService.markFailed(jobId, msg)
      void this.novuService.notifyProfileSyncFailed(username, jobId, msg)
      this.logger.error(`Profile sync job ${jobId} failed: ${msg}`)
    }
  }

  private async fetchAndSaveComments(
    client: Parameters<typeof fetchAllComments>[0],
    repo: { owner: string; name: string },
    username: string,
  ): Promise<number> {
    try {
      const all = await fetchAllComments(client, repo.owner, repo.name)
      const mine = all.filter((c) => c.username === username)
      await Promise.all(mine.map((c) =>
        this.commentModel.findOneAndUpdate(
          { githubId: c.githubId },
          { ...c, username },
          { upsert: true, new: true },
        ).exec(),
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

  async findJob(jobId: string): Promise<ProfileSyncJob | null> {
    return this.jobsService.findById(jobId)
  }

  async findProfile(username: string): Promise<ProfileDocument | null> {
    return this.profileModel.findOne({ username }).lean()
  }

  async listProfiles(): Promise<ProfileDocument[]> {
    return this.profileModel.find().sort({ followers: -1 }).lean()
  }

  async getPersonaContext(username: string) {
    const profile = await this.findProfile(username)
    if (!profile) return null
    const [skills, preferences] = await Promise.all([
      this.skillsService.findByUsername(username),
      this.preferencesService.findByUsername(username),
    ])
    return { profile, skills, preferences }
  }
}
