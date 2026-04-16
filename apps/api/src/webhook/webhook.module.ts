import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { WebhookController } from './webhook.controller.js'
import { WebhookService } from './webhook.service.js'

/** Encapsulates GitHub webhook reception and dispatch. */
@Module({
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
