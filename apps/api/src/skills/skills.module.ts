import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MeModule } from '../me/me.module.js'
import { Skill, SkillSchema } from './skill.schema.js'
import { SkillsService } from './skills.service.js'
import { SkillsController } from './skills.controller.js'

@Module({
  imports: [
    MeModule,
    MongooseModule.forFeature([{ name: Skill.name, schema: SkillSchema }]),
  ],
  controllers: [SkillsController],
  providers: [SkillsService],
  exports: [MongooseModule],
})
export class SkillsModule {}
