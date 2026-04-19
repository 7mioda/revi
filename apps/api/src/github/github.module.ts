import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { InfrastructureModule } from './infrastructure/infrastructure.module.js'
import {
  FetchUserReposService,
  FetchUserCommentsService,
  HandleInstallCallbackService,
  HandleOAuthCallbackService,
  HandleCombinedCallbackService,
  ProcessWebhookService,
  PostCommentService,
  GetUserNotificationsService,
  ListInstallationsService,
} from './services/index.js'
import {
  GetReposController,
  FetchCommentsController,
  InstallController,
  GithubCallbackController,
  ReceiveWebhookController,
  ListInstallationsController,
  PostCommentController,
  GetNotificationsController,
} from './controllers/index.js'
import { GithubAppClientService } from './infrastructure/octokit/github-app-client.service.js'

const services = [
  FetchUserReposService,
  FetchUserCommentsService,
  HandleInstallCallbackService,
  HandleOAuthCallbackService,
  HandleCombinedCallbackService,
  ProcessWebhookService,
  PostCommentService,
  GetUserNotificationsService,
  ListInstallationsService,
]

const controllers = [
  GetReposController,
  FetchCommentsController,
  InstallController,
  GithubCallbackController,
  ReceiveWebhookController,
  ListInstallationsController,
  PostCommentController,
  GetNotificationsController,
]

/**
 * Encapsulates all GitHub-related functionality:
 * - Infrastructure: Mongoose schemas, repositories, GitHub App client
 * - Services: one service per use-case
 * - Controllers: one folder per use-case
 */
@Module({
  imports: [InfrastructureModule],
  controllers,
  providers: services,
  exports: [GithubAppClientService, ...services],
})
export class GithubModule {}
