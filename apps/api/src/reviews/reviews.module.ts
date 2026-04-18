import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { PreferencesModule } from '../preferences/preferences.module.js'
import { Skill, SkillSchema } from '../skills/skill.schema.js'
import { Profile, ProfileSchema } from '../profiles/profile.schema.js'
import { ReviewsService } from './reviews.service.js'
import { ReviewsController } from './reviews.controller.js'

@Module({
  imports: [
    PreferencesModule,
    MongooseModule.forFeature([
      { name: Skill.name, schema: SkillSchema },
      { name: Profile.name, schema: ProfileSchema },
    ]),
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
