import { Injectable, Inject, Logger } from '@nestjs/common'
import { WebhookEventRepository } from '../infrastructure/persistence/webhook-event.repository.js'
import { InstallationRepository } from '../infrastructure/persistence/installation.repository.js'

/** Safely extracts the `action` string from an unknown webhook payload. */
function extractAction(payload: unknown): string {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'action' in payload &&
    typeof payload.action === 'string'
  ) {
    return payload.action
  }
  return ''
}

/** Safely extracts `installation.id` from an unknown webhook payload. */
function extractInstallationId(payload: unknown): number | null {
  if (typeof payload !== 'object' || payload === null) return null
  if (!('installation' in payload)) return null
  const inst = payload.installation
  if (typeof inst !== 'object' || inst === null) return null
  if (!('id' in inst) || typeof inst.id !== 'number') return null
  return inst.id
}

interface InstallationAccount {
  login: string
  type: string
}

interface InstallationPayload {
  installation: {
    id: number
    account: InstallationAccount
  }
}

function isInstallationPayload(v: unknown): v is InstallationPayload {
  if (typeof v !== 'object' || v === null) return false
  if (!('installation' in v)) return false
  const inst = v.installation
  if (typeof inst !== 'object' || inst === null) return false
  if (!('id' in inst) || typeof inst.id !== 'number') return false
  if (!('account' in inst)) return false
  const acc = inst.account
  if (typeof acc !== 'object' || acc === null) return false
  return 'login' in acc && typeof acc.login === 'string' && 'type' in acc && typeof acc.type === 'string'
}

/**
 * Records webhook deliveries and dispatches to per-event handlers.
 * Idempotent — duplicate delivery IDs are silently dropped via the MongoDB
 * unique index on `deliveryId`.
 */
@Injectable()
export class ProcessWebhookService {
  private readonly logger = new Logger(ProcessWebhookService.name)

  constructor(
    @Inject(WebhookEventRepository) private readonly webhookRepo: WebhookEventRepository,
    @Inject(InstallationRepository) private readonly installationRepo: InstallationRepository,
  ) {}

  async execute(deliveryId: string, event: string, payload: unknown): Promise<void> {
    const action = extractAction(payload)
    const installationId = extractInstallationId(payload)

    const isNew = await this.webhookRepo.record(deliveryId, event, action, installationId, payload)
    if (!isNew) {
      this.logger.log(`Skipping duplicate webhook delivery ${deliveryId}`)
      return
    }

    const key = action ? `${event}.${action}` : event
    switch (key) {
      case 'installation.created':
        await this.handleInstallationCreated(payload)
        break
      case 'installation.deleted':
        await this.handleInstallationDeleted(payload)
        break
      case 'installation_repositories.added':
      case 'installation_repositories.removed':
        this.logger.log(`Installation repositories ${action} — delivery ${deliveryId}`)
        // TODO: sync repository list for this installation
        break
      case 'issue_comment.created':
        this.logger.log(`Issue comment created — delivery ${deliveryId}`)
        // TODO: business logic (e.g. trigger review on mention)
        break
      case 'issues.opened':
        this.logger.log(`Issue opened — delivery ${deliveryId}`)
        // TODO: business logic
        break
      case 'pull_request.opened':
        this.logger.log(`Pull request opened — delivery ${deliveryId}`)
        // TODO: business logic (e.g. trigger automated review)
        break
      case 'pull_request_review_comment.created':
        this.logger.log(`PR review comment created — delivery ${deliveryId}`)
        // TODO: business logic
        break
      default:
        this.logger.log(`Unhandled webhook event: ${key} (delivery ${deliveryId})`)
    }
  }

  private async handleInstallationCreated(payload: unknown): Promise<void> {
    if (!isInstallationPayload(payload)) {
      this.logger.warn('installation.created: unexpected payload shape')
      return
    }
    await this.installationRepo.upsert(
      payload.installation.id,
      payload.installation.account.login,
      payload.installation.account.type,
      payload as unknown as Record<string, unknown>,
    )
    this.logger.log(
      `Installation created: #${payload.installation.id} for ${payload.installation.account.login}`,
    )
  }

  private async handleInstallationDeleted(payload: unknown): Promise<void> {
    if (!isInstallationPayload(payload)) {
      this.logger.warn('installation.deleted: unexpected payload shape')
      return
    }
    await this.installationRepo.remove(payload.installation.id)
    this.logger.log(`Installation deleted: #${payload.installation.id}`)
  }
}
