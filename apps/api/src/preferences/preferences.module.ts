import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MeModule } from '../me/me.module.js'
import { UsersModule } from '../users/users.module.js'
import { Preference, PreferenceSchema } from './preference.schema.js'
import { PreferencesService } from './preferences.service.js'
import { PreferencesController } from './preferences.controller.js'

@Module({
  imports: [
    MeModule,
    UsersModule,
    MongooseModule.forFeature([{ name: Preference.name, schema: PreferenceSchema }]),
  ],
  controllers: [PreferencesController],
  providers: [PreferencesService],
  exports: [MongooseModule],
})
export class PreferencesModule {}
