import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import type { Model } from 'mongoose'
import { GithubUser } from './schemas/github-user.schema.js'
import type { GithubUserDocument } from './schemas/github-user.schema.js'

export interface UserTokens {
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
  refreshTokenExpiresAt: Date | null
}

@Injectable()
export class GithubUserRepository {
  constructor(
    @InjectModel(GithubUser.name)
    private readonly model: Model<GithubUserDocument>,
  ) {}

  async findOne(githubUserId: number): Promise<GithubUserDocument | null> {
    return this.model.findOne({ githubUserId }).lean().exec() as Promise<GithubUserDocument | null>
  }

  async upsert(
    githubUserId: number,
    login: string,
    accessTokenEncrypted: string,
    refreshTokenEncrypted: string | null,
    accessTokenExpiresAt: Date | null,
    refreshTokenExpiresAt: Date | null,
    installationId?: number,
  ): Promise<void> {
    await this.model
      .findOneAndUpdate(
        { githubUserId },
        {
          githubUserId,
          login,
          accessTokenEncrypted,
          refreshTokenEncrypted,
          accessTokenExpiresAt,
          refreshTokenExpiresAt,
          ...(installationId !== undefined && { installationId }),
        },
        { upsert: true, new: true },
      )
      .exec()
  }

  async updateTokens(
    githubUserId: number,
    accessTokenEncrypted: string,
    refreshTokenEncrypted: string,
    accessTokenExpiresAt: Date | null,
    refreshTokenExpiresAt: Date | null,
  ): Promise<void> {
    await this.model
      .findOneAndUpdate(
        { githubUserId },
        { accessTokenEncrypted, refreshTokenEncrypted, accessTokenExpiresAt, refreshTokenExpiresAt },
      )
      .exec()
  }
}
