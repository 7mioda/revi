import 'reflect-metadata'
import { Controller, Post, HttpCode, HttpStatus, Req, Inject } from '@nestjs/common'
import type { RawBodyRequest } from '@nestjs/common'
import type { Request } from 'express'
import { Public } from '../../../auth/public.decorator.js'
import { GithubAppClientService } from '../../infrastructure/octokit/github-app-client.service.js'
import { ProcessWebhookService } from '../../services/process-webhook.service.js'

/**
 * Receives GitHub App webhook deliveries. Verifies the HMAC signature,
 * deduplicates by delivery ID, and dispatches event handlers asynchronously.
 *
 * `POST /webhooks/github`
 */
@Controller()
export class ReceiveWebhookController {
  constructor(
    @Inject(GithubAppClientService) private readonly githubAppClient: GithubAppClientService,
    @Inject(ProcessWebhookService) private readonly processWebhook: ProcessWebhookService,
  ) {}

  @Public()
  @Post('webhooks/github')
  @HttpCode(HttpStatus.OK)
  webhook(@Req() req: RawBodyRequest<Request>): { ok: boolean } {
    const rawBody = req.rawBody ?? Buffer.alloc(0)
    const deliveryId = req.headers['x-github-delivery'] as string | undefined
    const event = req.headers['x-github-event'] as string | undefined
    const signature = req.headers['x-hub-signature-256'] as string | undefined

    this.githubAppClient.verifyWebhookSignature(rawBody, signature)

    // Fire-and-forget — respond to GitHub immediately
    void this.processWebhook.execute(
      deliveryId ?? 'unknown',
      event ?? 'unknown',
      req.body as unknown,
    )

    return { ok: true }
  }
}
