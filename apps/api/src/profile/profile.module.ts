import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { InfrastructureModule } from './infrastructure/infrastructure.module.js'
import {
  CreateProfileController,
  GetProfileController,
  UpdateProfileController,
  DeleteProfileController,
  ListProfileSkillsController,
  GetSkillController,
} from './controllers/index.js'
import {
  CreateProfileService,
  DeleteProfileService,
  UpdateProfileService,
} from './services/index.js'

@Module({
  imports: [ConfigModule, InfrastructureModule],
  controllers: [
    CreateProfileController,
    GetProfileController,
    UpdateProfileController,
    DeleteProfileController,
    ListProfileSkillsController,
    GetSkillController,
  ],
  providers: [
    CreateProfileService,
    DeleteProfileService,
    UpdateProfileService,
  ],
})
export class ProfileModule {}
