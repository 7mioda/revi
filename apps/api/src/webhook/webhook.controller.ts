import 'reflect-metadata'
import {
  Controller,
  Post,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import type { RawBodyRequest } from '@nestjs/common'
import type { Request } from 'express'
import { WebhookService } from './webhook.service.js'
import { Public } from '../auth/public.decorator.js'

/**
 * Receives GitHub webhook events.
 * Signature verification and event dispatching are delegated to `WebhookService`.
 */
@Public()
@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhook: WebhookService) {}

  /**
   * Entry point for all GitHub webhook deliveries.
   * `POST /webhook/github`
   *
   * GitHub requires a 2xx response within 10 seconds — the review command is
   * spawned as a detached process so this handler returns immediately after
   * verification.
   */
  @Post('github')
  @HttpCode(HttpStatus.NO_CONTENT)
  handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-github-event') event: string | undefined,
    @Headers('x-hub-signature-256') signature: string | undefined,
  ): void {
    const rawBody = req.rawBody ?? Buffer.alloc(0)
    this.webhook.verifySignature(rawBody, signature)
    this.webhook.handleEvent(event ?? '', req.body as unknown)
  }
}
