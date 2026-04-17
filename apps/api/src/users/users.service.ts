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
  listAccessibleRepos,
  fetchAllComments,
} from '@revi/octokit'
import type { OctokitClient, GithubIssue } from '@revi/octokit'
import { Issue } from './issue.schema.js'
import { PullRequest } from './pull-request.schema.js'
import { Comment } from '../me/comment.schema.js'
import { JobsService } from './jobs.service.js'
import type { Env } from '../config.js'

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)

  constructor(
    @InjectModel(Issue.name) private readonly issueModel: Model<Issue>,
    @InjectModel(PullRequest.name) private readonly prModel: Model<PullRequest>,
    @InjectModel(Comment.name) private readonly commentModel: Model<Comment>,
    @Inject(JobsService) private readonly jobsService: JobsService,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Runs the four-step activity pipeline and tracks progress in the job document.
   *
   * - Always uses an authenticated client: user token takes priority, server
   *   GITHUB_TOKEN is the fallback. This ensures 5,000 req/hr instead of 60.
   * - Comment fetching scope = only repos where the user has commented
   *   (searchReposWithCommenter), not all accessible repos.
   * - Comment fetches are capped at 5 concurrent repos to avoid secondary
   *   rate limits.
   *
   * @param jobId    - ID of the `ActivityJob` document created before this call.
   * @param username - GitHub login of the user to fetch activity for.
   * @param token    - Optional user PAT. Falls back to server GITHUB_TOKEN.
   */
  async run(jobId: string, username: string, token?: string): Promise<void> {
    await this.jobsService.markRunning(jobId)
    try {
      // Always authenticated: user token wins, server token is fallback.
      const effectiveToken = token ?? this.config.get('GITHUB_TOKEN')
      const client = createOctokitClient(effectiveToken)

      // Step 1 — Issues
      await this.jobsService.updateStep(jobId, 'issues', 'running')
      const issues = await fetchUserIssues(client, username)
      await this.upsertIssues(issues, username)
      await this.jobsService.updateStep(jobId, 'issues', 'done', issues.length)
      this.logger.log(`Step 1: fetched ${issues.length} issues for ${username}`)

      // Step 2 — Pull requests + diffs
      await this.jobsService.updateStep(jobId, 'pullRequests', 'running')
      const prs = await fetchUserPullRequests(client, username)
      for (const pr of prs) {
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
          { ...pr, userId: username, files },
          { upsert: true, new: true },
        ).exec()
      }
      await this.jobsService.updateStep(jobId, 'pullRequests', 'done', prs.length)
      this.logger.log(`Step 2: fetched ${prs.length} pull requests for ${username}`)

      // Step 3 — Repo discovery
      // commentRepos: repos where user has commented (search only) — used for Step 4
      // allRepos: full accessible surface (search + private) — used for the step count
      await this.jobsService.updateStep(jobId, 'repos', 'running')
      const commentRepos = await searchReposWithCommenter(client, username)
      const privateRepos = token !== undefined ? await listAccessibleRepos(client) : []
      const allRepos = deduplicateRepos([...commentRepos, ...privateRepos])
      await this.jobsService.updateStep(jobId, 'repos', 'done', allRepos.length)
      this.logger.log(`Step 3: discovered ${allRepos.length} repos for ${username} (${commentRepos.length} with comments)`)

      // Step 4 — Comments, fetched only from repos where user has commented.
      // Cap at 5 concurrent repos to avoid secondary rate limits.
      await this.jobsService.updateStep(jobId, 'comments', 'running')
      let commentCount = 0
      const limit = pLimit(5)
      const results = await Promise.all(
        commentRepos.map((repo) => limit(() => this.fetchAndSaveComments(client, repo, username))),
      )
      commentCount = results.reduce((sum, n) => sum + n, 0)
      await this.jobsService.updateStep(jobId, 'comments', 'done', commentCount)
      this.logger.log(`Step 4: upserted ${commentCount} comments for ${username}`)

      await this.jobsService.markDone(jobId)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      await this.jobsService.markFailed(jobId, msg)
    }
  }

  private async fetchAndSaveComments(
    client: OctokitClient,
    repo: { owner: string; name: string },
    username: string,
  ): Promise<number> {
    try {
      const all = await fetchAllComments(client, repo.owner, repo.name)
      const mine = all.filter((c) => c.username === username)
      await Promise.all(mine.map((c) =>
        this.commentModel.findOneAndUpdate(
          { githubId: c.githubId },
          { ...c, userId: username },
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

  private async upsertIssues(issues: GithubIssue[], userId: string): Promise<void> {
    await Promise.all(issues.map((issue) =>
      this.issueModel.findOneAndUpdate(
        { githubId: issue.githubId },
        { ...issue, userId },
        { upsert: true, new: true },
      ).exec(),
    ))
  }

}

/**
 * Deduplicates a `RepoRef` list by `owner/name`, preserving first-occurrence order.
 */
function deduplicateRepos(
  repos: Array<{ owner: string; name: string }>,
): Array<{ owner: string; name: string }> {
  const seen = new Set<string>()
  return repos.filter(({ owner, name }) => {
    const key = `${owner}/${name}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
