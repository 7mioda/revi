import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MeModule } from '../me/me.module.js'
import { UsersModule } from '../users/users.module.js'
import { PreferencesModule } from '../preferences/preferences.module.js'
import { SkillsModule } from '../skills/skills.module.js'
import { NovuModule } from '../novu/novu.module.js'
import { NovuService } from '../novu/novu.service.js'
import { PreferencesService } from '../preferences/preferences.service.js'
import { SkillsService } from '../skills/skills.service.js'
import { Discussion, DiscussionSchema } from '../users/discussion.schema.js'
import { Profile, ProfileSchema } from './profile.schema.js'
import { ProfileSyncJob, ProfileSyncJobSchema } from './profile-sync-job.schema.js'
import { ProfileJobsService } from './profile-jobs.service.js'
import { ProfilesService } from './profiles.service.js'
import { ProfilesController } from './profiles.controller.js'

@Module({
  imports: [
    MeModule,
    UsersModule,
    PreferencesModule,
    SkillsModule,
    NovuModule,
    MongooseModule.forFeature([
      { name: Discussion.name, schema: DiscussionSchema },
      { name: Profile.name, schema: ProfileSchema },
      { name: ProfileSyncJob.name, schema: ProfileSyncJobSchema },
    ]),
  ],
  controllers: [ProfilesController],
  providers: [ProfileJobsService, ProfilesService, PreferencesService, SkillsService, NovuService],
})
export class ProfilesModule {}
