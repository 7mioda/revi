import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { Guard } from './clerk.guard.js'

@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: Guard,
    },
  ],
})
export class AuthModule {}
