import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import type { Model } from 'mongoose'
import { WebhookEvent } from './schemas/webhook-event.schema.js'
import type { WebhookEventDocument } from './schemas/webhook-event.schema.js'

/** Returns true if the error is a MongoDB duplicate key violation (E11000). */
function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 11000
}

@Injectable()
export class WebhookEventRepository {
  constructor(
    @InjectModel(WebhookEvent.name)
    private readonly model: Model<WebhookEventDocument>,
  ) {}

  /**
   * Inserts a webhook event record, using the unique `deliveryId` index as the
   * idempotency guard.
   *
   * @returns `true` if inserted (new delivery), `false` if duplicate.
   */
  async record(
    deliveryId: string,
    event: string,
    action: string,
    installationId: number | null,
    payload: unknown,
  ): Promise<boolean> {
    try {
      await this.model.create({
        deliveryId,
        event,
        action,
        installationId,
        receivedAt: new Date(),
        payloadJson: payload as Record<string, unknown>,
      })
      return true
    } catch (err) {
      if (isDuplicateKeyError(err)) return false
      throw err
    }
  }
}
