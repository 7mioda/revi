import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Installation, InstallationSchema } from './persistence/schemas/installation.schema.js'
import { GithubUser, GithubUserSchema } from './persistence/schemas/github-user.schema.js'
import { WebhookEvent, WebhookEventSchema } from './persistence/schemas/webhook-event.schema.js'
import { InstallationRepository } from './persistence/installation.repository.js'
import { GithubUserRepository } from './persistence/github-user.repository.js'
import { WebhookEventRepository } from './persistence/webhook-event.repository.js'
import { GithubAppClientService } from './octokit/github-app-client.service.js'

/**
 * Provides all infrastructure-layer dependencies for the GitHub module:
 * Mongoose schemas, repositories, and the GitHub App client.
 *
 * Import this module from `GithubModule` to wire up the full stack.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Installation.name, schema: InstallationSchema },
      { name: GithubUser.name, schema: GithubUserSchema },
      { name: WebhookEvent.name, schema: WebhookEventSchema },
    ]),
  ],
  providers: [InstallationRepository, GithubUserRepository, WebhookEventRepository, GithubAppClientService],
  exports: [InstallationRepository, GithubUserRepository, WebhookEventRepository, GithubAppClientService],
})
export class InfrastructureModule {}
