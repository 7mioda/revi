import 'reflect-metadata'
import { Injectable, Inject, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { ConfigService } from '@nestjs/config'
import type { Model } from 'mongoose'
import {
  createOctokitClient,
  searchReposWithCommenter,
  fetchAllComments,
} from '@revi/octokit'
import type { CommentType, GithubComment } from '@revi/octokit'
import { Comment } from '../me/comment.schema.js'
import type { Env } from '../config.js'

export interface FetchUserCommentsResult {
  user: string
  saved: number
  breakdown: Record<CommentType, number>
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)

  constructor(
    @InjectModel(Comment.name) private readonly commentModel: Model<Comment>,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Fetches public comments for a given GitHub username using the server's own
   * GitHub token. Uses `GET /search/issues?q=commenter:{username}` to discover
   * every repo the user has commented in (not just repos they own), then fetches
   * all comments from each discovered repo and filters to those authored by the
   * target username. Upserts into MongoDB with `userId = username`.
   */
  async fetchAndSave(username: string): Promise<FetchUserCommentsResult> {
    const token = this.config.get('GITHUB_TOKEN')
    const client = createOctokitClient(token)

    const repos = await searchReposWithCommenter(client, username)
    this.logger.log(`Found ${repos.length} repos with comments by ${username}`)

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

    const mine = allComments.filter((c) => c.username === username)
    this.logger.log(`Upserting ${mine.length} comments for ${username}`)

    await Promise.all(mine.map((c) =>
      this.commentModel.findOneAndUpdate(
        { githubId: c.githubId },
        { ...c, userId: username },
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

    return { user: username, saved: mine.length, breakdown }
  }
}
