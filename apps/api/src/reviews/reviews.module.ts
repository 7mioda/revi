import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Skill, SkillSchema } from '../skills/skill.schema.js'
import { ReviewsService } from './reviews.service.js'
import { ReviewsController } from './reviews.controller.js'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Skill.name, schema: SkillSchema }]),
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
