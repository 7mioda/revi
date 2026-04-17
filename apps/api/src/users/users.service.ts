import 'reflect-metadata'
import { Injectable, Inject, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { ConfigService } from '@nestjs/config'
import type { Model } from 'mongoose'
import {
  createOctokitClient,
  fetchUserIssues,
  fetchUserPullRequests,
  fetchPRDiff,
  searchReposWithCommenter,
  listAccessibleRepos,
  fetchAllComments,
} from '@revi/octokit'
import type { GithubIssue } from '@revi/octokit'
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
   * @param jobId    - ID of the `ActivityJob` document created before this call.
   * @param username - GitHub login of the user to fetch activity for.
   * @param token    - Optional PAT. When absent, only public resources are fetched.
   */
  async run(jobId: string, username: string, token?: string): Promise<void> {
    await this.jobsService.markRunning(jobId)
    try {
      const client = createOctokitClient(token)

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
      await this.jobsService.updateStep(jobId, 'repos', 'running')
      const publicRepos = await searchReposWithCommenter(client, username)
      const privateRepos = token !== undefined ? await listAccessibleRepos(client) : []
      const repos = deduplicateRepos([...publicRepos, ...privateRepos])
      await this.jobsService.updateStep(jobId, 'repos', 'done', repos.length)
      this.logger.log(`Step 3: discovered ${repos.length} repos for ${username}`)

      // Step 4 — Comments, stored after each repo (progressive)
      await this.jobsService.updateStep(jobId, 'comments', 'running')
      let commentCount = 0
      for (const repo of repos) {
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
          commentCount += mine.length
        } catch (err: unknown) {
          const status = typeof err === 'object' && err !== null && 'status' in err
            ? (err as { status: number }).status
            : 'unknown'
          this.logger.warn(`Skipping ${repo.owner}/${repo.name} — HTTP ${status}`)
        }
      }
      await this.jobsService.updateStep(jobId, 'comments', 'done', commentCount)
      this.logger.log(`Step 4: upserted ${commentCount} comments for ${username}`)

      await this.jobsService.markDone(jobId)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      await this.jobsService.markFailed(jobId, msg)
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
