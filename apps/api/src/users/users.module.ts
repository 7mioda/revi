import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { UsersController } from './users.controller.js'
import { UsersService } from './users.service.js'
import { JobsService } from './jobs.service.js'
import { Issue, IssueSchema } from './issue.schema.js'
import { PullRequest, PullRequestSchema } from './pull-request.schema.js'
import { ActivityJob, ActivityJobSchema } from './job.schema.js'
import { MeModule } from '../me/me.module.js'

/**
 * Encapsulates public-user activity fetching (issues, pull requests, comments).
 * Re-uses the Comment model exported from MeModule, and registers its own
 * Issue, PullRequest, and ActivityJob models.
 */
@Module({
  imports: [
    MeModule,
    MongooseModule.forFeature([
      { name: Issue.name, schema: IssueSchema },
      { name: PullRequest.name, schema: PullRequestSchema },
      { name: ActivityJob.name, schema: ActivityJobSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService, JobsService],
})
export class UsersModule {}
