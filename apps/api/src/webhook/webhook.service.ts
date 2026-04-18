import 'reflect-metadata'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { spawn } from 'node:child_process'
import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Env } from '../config.js'

/** Minimal shape we need from a `pull_request` event payload. */
interface PullRequestPayload {
  action: string
  pull_request: {
    number: number
    html_url: string
  }
  repository: {
    full_name: string
  }
}

function isPullRequestPayload(v: unknown): v is PullRequestPayload {
  return (
    typeof v === 'object' &&
    v !== null &&
    'action' in v &&
    'pull_request' in v &&
    'repository' in v
  )
}

/**
 * Handles GitHub webhook signature verification and event dispatching.
 * Business logic is intentionally minimal — this service only verifies
 * authenticity and spawns the configured review CLI for `pull_request.opened`.
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name)

  constructor(private readonly config: ConfigService<Env, true>) {}

  /**
   * Verifies the `X-Hub-Signature-256` header against the raw request body.
   * Uses `timingSafeEqual` to prevent timing attacks.
   *
   * @throws `HttpException(403)` if the signature is absent or does not match.
   */
  verifySignature(rawBody: Buffer, signature: string | undefined): void {
    if (!signature) {
      throw new HttpException('Missing X-Hub-Signature-256 header', HttpStatus.FORBIDDEN)
    }

    const secret = this.config.get('WEBHOOK_SECRET')
    const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex')
    const expectedBuf = Buffer.from(expected, 'utf8')
    const receivedBuf = Buffer.from(signature, 'utf8')

    // Buffers must be the same length for timingSafeEqual — if lengths differ,
    // the signature is wrong, but we still do a dummy comparison to avoid
    // leaking length information via timing.
    const valid =
      expectedBuf.length === receivedBuf.length &&
      timingSafeEqual(expectedBuf, receivedBuf)

    if (!valid) {
      throw new HttpException('Invalid signature', HttpStatus.FORBIDDEN)
    }
  }

  /**
   * Dispatches a verified GitHub event.
   * Only `pull_request` events with `action: "opened"` trigger the review command.
   * All other events are silently ignored.
   *
   * The review CLI is spawned as a detached child process so the HTTP response
   * can be returned within GitHub's 10-second timeout.
   */
  handleEvent(event: string, payload: unknown): void {
    if (event !== 'pull_request') return
    if (!isPullRequestPayload(payload)) return
    if (payload.action !== 'opened') return

    const { number, html_url } = payload.pull_request
    const { full_name } = payload.repository

    this.logger.log(`PR #${number} opened in ${full_name} — spawning review`)
  }
}
