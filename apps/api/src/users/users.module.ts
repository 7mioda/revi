import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { UsersController } from './users.controller.js'
import { UsersService } from './users.service.js'
import { Issue, IssueSchema } from './issue.schema.js'
import { PullRequest, PullRequestSchema } from './pull-request.schema.js'
import { MeModule } from '../me/me.module.js'

/**
 * Encapsulates public-user activity fetching (issues, pull requests, comments).
 * Re-uses the Comment model exported from MeModule, and registers its own
 * Issue and PullRequest models.
 */
@Module({
  imports: [
    MeModule,
    MongooseModule.forFeature([
      { name: Issue.name, schema: IssueSchema },
      { name: PullRequest.name, schema: PullRequestSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
