import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { UsersController } from './users.controller.js'
import { UsersService } from './users.service.js'
import { MeModule } from '../me/me.module.js'

/**
 * Encapsulates public-user comment fetching.
 * Re-uses the Comment model exported from MeModule.
 */
@Module({
  imports: [MeModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
