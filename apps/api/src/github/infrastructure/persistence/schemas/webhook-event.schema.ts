import 'reflect-metadata'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'

export type WebhookEventDocument = HydratedDocument<WebhookEvent>

/**
 * Persists every received GitHub App webhook delivery.
 * The unique index on `deliveryId` is the idempotency guard — inserting a
 * duplicate delivery ID returns false without re-dispatching the handler.
 */
@Schema({ collection: 'github_webhook_events', timestamps: false })
export class WebhookEvent {
  /** `X-GitHub-Delivery` header value — globally unique per GitHub delivery. */
  @Prop({ type: String, required: true, unique: true, index: true })
  deliveryId!: string

  /** `X-GitHub-Event` header value, e.g. `installation`, `issue_comment`. */
  @Prop({ type: String, required: true })
  event!: string

  /** `action` field from the payload, e.g. `created`, `deleted`. */
  @Prop({ type: String, default: '' })
  action!: string

  @Prop({ type: Number, default: null })
  installationId!: number | null

  @Prop({ type: Date, required: true })
  receivedAt!: Date

  @Prop({ type: Object, required: true })
  payloadJson!: Record<string, unknown>
}

export const WebhookEventSchema = SchemaFactory.createForClass(WebhookEvent)
