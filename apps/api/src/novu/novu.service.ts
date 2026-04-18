import 'reflect-metadata'
import { Injectable, Inject, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createNovuClient, sendNotification } from '@revi/novu'
import type { Env } from '../config.js'

@Injectable()
export class NovuService {
  private readonly logger = new Logger(NovuService.name)
  private readonly client: ReturnType<typeof createNovuClient> | null

  constructor(@Inject(ConfigService) private readonly config: ConfigService<Env, true>) {
    const apiKey = this.config.get('NOVU_API_KEY', { infer: true })
    this.client = apiKey ? createNovuClient(apiKey) : null
    if (!this.client) {
      this.logger.warn('NOVU_API_KEY not set — notifications are disabled')
    }
  }

  async notifyProfileSyncDone(username: string, jobId: string): Promise<void> {
    if (!this.client) return
    const result = await sendNotification(
      this.client,
      username,
      'profile-sync-done',
      { jobId, username, message: `Profile sync completed for ${username}` },
    )
    if (!result.ok) {
      this.logger.error(`Novu trigger failed (profile-sync-done)`)
    }
  }

  async notifyProfileSyncFailed(username: string, jobId: string, errorMsg: string): Promise<void> {
    if (!this.client) return
    const result = await sendNotification(
      this.client,
      username,
      'profile-sync-failed',
      { jobId, username, message: errorMsg },
    )
    if (!result.ok) {
      this.logger.error(`Novu trigger failed (profile-sync-failed)`)
    }
  }
}
