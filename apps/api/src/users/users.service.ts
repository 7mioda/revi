import 'reflect-metadata'
import { Injectable, Inject, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { ConfigService } from '@nestjs/config'
import type { Model } from 'mongoose'
import {
  createOctokitClient,
  fetchUserIssues,
  fetchUserPullRequests,
  searchReposWithCommenter,
  listAccessibleRepos,
  fetchAllComments,
} from '@revi/octokit'
import type { GithubIssue, GithubPullRequest } from '@revi/octokit'
import { Issue } from './issue.schema.js'
import { PullRequest } from './pull-request.schema.js'
import { Comment } from '../me/comment.schema.js'
import type { Env } from '../config.js'

/** Result returned by `fetchAndSave`. */
export interface UserActivityResult {
  /** GitHub login of the target user. */
  user: string
  /** Number of issues upserted. */
  issues: number
  /** Number of pull requests upserted. */
  pullRequests: number
  /** Number of comments upserted. */
  comments: number
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)

  constructor(
    @InjectModel(Issue.name) private readonly issueModel: Model<Issue>,
    @InjectModel(PullRequest.name) private readonly prModel: Model<PullRequest>,
    @InjectModel(Comment.name) private readonly commentModel: Model<Comment>,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Fetches issues, pull requests, and comments for `username` in four sequential
   * steps, persisting each resource type before moving to the next.
   *
   * - Step 1 & 2 use the GitHub Search API — no repo iteration needed, and they
   *   work without a token for public data.
   * - Step 3 discovers repos via the search commenter index; when `token` is
   *   provided, private repos accessible to that token are merged in.
   * - Step 4 iterates repos and upserts each repo's comments immediately, so
   *   progress is preserved even if the process is interrupted.
   *
   * @param username - GitHub login of the user to fetch activity for.
   * @param token    - Optional PAT. When absent, only public resources are fetched.
   * @returns Counts of each resource type upserted.
   */
  async fetchAndSave(username: string, token?: string): Promise<UserActivityResult> {
    const client = createOctokitClient(token)

    // Step 1 — Issues
    const issues = await fetchUserIssues(client, username)
    this.logger.log(`Step 1: fetched ${issues.length} issues for ${username}`)
    await this.upsertIssues(issues, username)

    // Step 2 — Pull requests
    const prs = await fetchUserPullRequests(client, username)
    this.logger.log(`Step 2: fetched ${prs.length} pull requests for ${username}`)
    await this.upsertPullRequests(prs, username)

    // Step 3 — Repo discovery (search + private if token given)
    const publicRepos = await searchReposWithCommenter(client, username)
    const privateRepos = token !== undefined ? await listAccessibleRepos(client) : []
    const repos = deduplicateRepos([...publicRepos, ...privateRepos])
    this.logger.log(`Step 3: discovered ${repos.length} repos for ${username}`)

    // Step 4 — Comments, stored after each repo (progressive)
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
    this.logger.log(`Step 4: upserted ${commentCount} comments for ${username}`)

    return { user: username, issues: issues.length, pullRequests: prs.length, comments: commentCount }
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

  private async upsertPullRequests(prs: GithubPullRequest[], userId: string): Promise<void> {
    await Promise.all(prs.map((pr) =>
      this.prModel.findOneAndUpdate(
        { githubId: pr.githubId },
        { ...pr, userId },
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
