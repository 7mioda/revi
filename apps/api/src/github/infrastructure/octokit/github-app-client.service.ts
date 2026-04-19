import 'reflect-metadata'
import { readFileSync } from 'node:fs'
import { Injectable, Inject, Logger, BadRequestException, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { App } from '@octokit/app'
import { Octokit } from '@octokit/rest'
import type { Env } from '../../../config.js'
import { encryptToken, decryptToken, verifyWebhookSignature } from '../../lib/crypto.js'
import { generateState, signState, verifyState } from '../../lib/state.js'
import { GithubUserRepository } from '../persistence/github-user.repository.js'
import type { UserTokens } from '../persistence/github-user.repository.js'

export type { UserTokens }

/**
 * Owns the `@octokit/app` `App` instance and all GitHub API authentication
 * concerns: installation tokens, user OAuth, token refresh, webhook signature.
 *
 * Single responsibility: GitHub client authentication. No business logic.
 */
@Injectable()
export class GithubAppClientService {
  private readonly logger = new Logger(GithubAppClientService.name)
  readonly app: App

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
    @Inject(GithubUserRepository) private readonly userRepo: GithubUserRepository,
  ) {
    this.app = new App({
      appId: config.get('GITHUB_APP_ID'),
      privateKey: this.loadPrivateKey(),
      webhooks: { secret: config.get('GITHUB_APP_WEBHOOK_SECRET') },
      oauth: {
        clientId: config.get('GITHUB_APP_CLIENT_ID'),
        clientSecret: config.get('GITHUB_APP_CLIENT_SECRET'),
      },
    })
  }

  // ── Private key ────────────────────────────────────────────────────────────

  private loadPrivateKey(): string {
    const inlined = this.config.get('GITHUB_APP_PRIVATE_KEY', { infer: true })
    if (inlined) return inlined.replace(/\\n/g, '\n')

    const keyPath = this.config.get('GITHUB_APP_PRIVATE_KEY_PATH', { infer: true })
    if (keyPath) return readFileSync(keyPath, 'utf8')

    throw new Error(
      'GitHub App private key not configured. ' +
        'Set GITHUB_APP_PRIVATE_KEY (inline PEM, \\n-escaped) or GITHUB_APP_PRIVATE_KEY_PATH (file path).',
    )
  }

  // ── OAuth state ────────────────────────────────────────────────────────────

  /** Returns the GitHub install URL with a signed CSRF state token embedded. */
  getInstallUrl(): string {
    const slug = this.config.get('GITHUB_APP_SLUG')
    const key = this.config.get('TOKEN_ENCRYPTION_KEY')
    const nonce = generateState()
    const signedState = signState(nonce, key)
    return `https://github.com/apps/${slug}/installations/new?state=${encodeURIComponent(signedState)}`
  }

  /**
   * Verifies the signed state parameter from an OAuth callback.
   * @throws `BadRequestException` if the state is missing, invalid, or expired.
   */
  verifyCallbackState(state: string | undefined): void {
    if (!state) throw new BadRequestException('Missing state parameter')
    try {
      verifyState(state, this.config.get('TOKEN_ENCRYPTION_KEY'))
    } catch {
      throw new BadRequestException('Invalid or expired state')
    }
  }

  // ── Installation auth ──────────────────────────────────────────────────────

  /** Returns an Octokit authenticated as the given installation. */
  getInstallationOctokit(installationId: number): ReturnType<App['getInstallationOctokit']> {
    return this.app.getInstallationOctokit(installationId)
  }

  // ── User OAuth ─────────────────────────────────────────────────────────────

  /**
   * Exchanges a GitHub OAuth authorization code for user tokens.
   */
  async exchangeCode(code: string): Promise<UserTokens> {
    const { authentication } = await this.app.oauth.createToken({ code })
    return {
      accessToken: authentication.token,
      refreshToken:
        'refreshToken' in authentication && authentication.refreshToken !== undefined
          ? authentication.refreshToken
          : null,
      expiresAt:
        'expiresAt' in authentication && authentication.expiresAt !== undefined
          ? new Date(authentication.expiresAt)
          : null,
      refreshTokenExpiresAt:
        'refreshTokenExpiresAt' in authentication &&
        authentication.refreshTokenExpiresAt !== undefined
          ? new Date(authentication.refreshTokenExpiresAt)
          : null,
    }
  }

  /**
   * Returns an Octokit authenticated as the given GitHub user.
   * Transparently refreshes the access token if it expires within 5 minutes
   * and persists the new token pair.
   *
   * @throws `NotFoundException` if the user has no stored token.
   */
  async getUserOctokit(githubUserId: number): Promise<Octokit> {
    const user = await this.userRepo.findOne(githubUserId)
    if (!user) throw new NotFoundException(`GitHub user ${githubUserId} has no linked token`)

    const encKey = this.config.get('TOKEN_ENCRYPTION_KEY')
    let accessToken = decryptToken(user.accessTokenEncrypted, encKey)

    const shouldRefresh =
      user.accessTokenExpiresAt !== null &&
      Date.now() > user.accessTokenExpiresAt.getTime() - 5 * 60 * 1000

    if (shouldRefresh) {
      if (!user.refreshTokenEncrypted) {
        throw new Error(`User ${githubUserId} has no refresh token — re-authorization required`)
      }
      const refreshToken = decryptToken(user.refreshTokenEncrypted, encKey)
      const { authentication } = await this.app.oauth.refreshToken({ refreshToken })

      accessToken = authentication.token
      await this.userRepo.updateTokens(
        githubUserId,
        encryptToken(accessToken, encKey),
        'refreshToken' in authentication
          ? encryptToken(authentication.refreshToken, encKey)
          : user.refreshTokenEncrypted,
        'expiresAt' in authentication ? new Date(authentication.expiresAt) : user.accessTokenExpiresAt,
        'refreshTokenExpiresAt' in authentication
          ? new Date(authentication.refreshTokenExpiresAt)
          : user.refreshTokenExpiresAt,
      )
      this.logger.log(`Refreshed access token for GitHub user ${githubUserId}`)
    }

    return new Octokit({ auth: accessToken })
  }

  // ── Webhook signature ──────────────────────────────────────────────────────

  /** Verifies the `X-Hub-Signature-256` header; throws 403 if invalid. */
  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): void {
    verifyWebhookSignature(rawBody, signature, this.config.get('GITHUB_APP_WEBHOOK_SECRET'))
  }
}
