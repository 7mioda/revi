import 'reflect-metadata'
import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import type { Model } from 'mongoose'
import {
  createOctokitClient,
  getAuthenticatedUser,
  listAccessibleRepos,
  fetchAllComments,
} from '@revi/octokit'
import type { CommentType, GithubComment } from '@revi/octokit'
import { Comment } from './comment.schema.js'

/** Response shape returned by `POST /me/comments`. */
export interface FetchAndSaveResult {
  user: string
  saved: number
  breakdown: Record<CommentType, number>
}

/**
 * Orchestrates the full fetch-and-persist flow for a token-identified user.
 * Zero business logic — delegates fetching to `@revi/octokit` and persistence
 * to Mongoose.
 */
@Injectable()
export class MeService {
  private readonly logger = new Logger(MeService.name)

  constructor(
    @InjectModel(Comment.name) private readonly commentModel: Model<Comment>,
  ) {}

  /**
   * Given a GitHub personal access token:
   * 1. Identifies the authenticated user via `GET /user`
   * 2. Lists all accessible repos via `GET /user/repos`
   * 3. Fetches all comments from each repo (serially, rate-limit safe)
   * 4. Filters to comments authored by the authenticated user
   * 5. Upserts each comment into MongoDB by `githubId`
   *
   * @param token - A GitHub personal access token.
   * @returns Summary of the operation: user login, saved count, breakdown by type.
   */
  async fetchAndSave(token: string): Promise<FetchAndSaveResult> {
    const client = createOctokitClient(token)

    const user = await getAuthenticatedUser(client)
    this.logger.log(`Authenticated as ${user.login}`)

    const repos = await listAccessibleRepos(client)
    this.logger.log(`Found ${repos.length} accessible repos`)

    const allComments: GithubComment[] = []
    for (const repo of repos) {
      try {
        const comments = await fetchAllComments(client, repo.owner, repo.name)
        allComments.push(...comments)
      } catch (err: unknown) {
        const status = typeof err === 'object' && err !== null && 'status' in err
          ? (err as { status: number }).status
          : 'unknown'
        this.logger.warn(`Skipping ${repo.owner}/${repo.name} — HTTP ${status}`)
      }
    }

    const mine = allComments.filter((c) => c.username === user.login)
    this.logger.log(`Upserting ${mine.length} comments for ${user.login}`)

    await Promise.all(mine.map((c) =>
      this.commentModel.findOneAndUpdate(
        { githubId: c.githubId },
        c,
        { upsert: true, new: true },
      ).exec(),
    ))

    const breakdown: Record<CommentType, number> = {
      pr_review_comment: 0,
      pr_comment: 0,
      commit_comment: 0,
    }
    for (const c of mine) {
      breakdown[c.type] = (breakdown[c.type] ?? 0) + 1
    }

    return { user: user.login, saved: mine.length, breakdown }
  }
}
