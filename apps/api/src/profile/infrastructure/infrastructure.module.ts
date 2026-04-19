import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import {
  Profile, ProfileSchema,
  Skill, SkillSchema,
  Issue, IssueSchema,
  PullRequest, PullRequestSchema,
  Comment, CommentSchema,
  Preference, PreferenceSchema,
  Discussion, DiscussionSchema,
  ProfileJob, ProfileJobSchema,
  ProfileRepository, ProfileRepositoryMongo,
  SkillRepository, SkillRepositoryMongo,
  IssueRepository, IssueRepositoryMongo,
  PullRequestRepository, PullRequestRepositoryMongo,
  CommentRepository, CommentRepositoryMongo,
  PreferenceRepository, PreferenceRepositoryMongo,
  DiscussionRepository, DiscussionRepositoryMongo,
  ProfileJobRepository, ProfileJobRepositoryMongo,
} from './persistence/index.js'

const SCHEMAS = MongooseModule.forFeature([
  { name: Profile.name, schema: ProfileSchema },
  { name: Skill.name, schema: SkillSchema },
  { name: Issue.name, schema: IssueSchema },
  { name: PullRequest.name, schema: PullRequestSchema },
  { name: Comment.name, schema: CommentSchema },
  { name: Preference.name, schema: PreferenceSchema },
  { name: Discussion.name, schema: DiscussionSchema },
  { name: ProfileJob.name, schema: ProfileJobSchema },
])

const REPOSITORIES = [
  { provide: ProfileRepository, useClass: ProfileRepositoryMongo },
  { provide: SkillRepository, useClass: SkillRepositoryMongo },
  { provide: IssueRepository, useClass: IssueRepositoryMongo },
  { provide: PullRequestRepository, useClass: PullRequestRepositoryMongo },
  { provide: CommentRepository, useClass: CommentRepositoryMongo },
  { provide: PreferenceRepository, useClass: PreferenceRepositoryMongo },
  { provide: DiscussionRepository, useClass: DiscussionRepositoryMongo },
  { provide: ProfileJobRepository, useClass: ProfileJobRepositoryMongo },
]

@Module({
  imports: [SCHEMAS],
  providers: REPOSITORIES,
  exports: [SCHEMAS, ...REPOSITORIES],
})
export class InfrastructureModule {}
