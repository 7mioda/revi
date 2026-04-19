import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { MongooseModule } from '@nestjs/mongoose'
import { validateEnv } from './config.js'
import type { Env } from './config.js'
import { GithubModule } from './github/github.module.js'
import { AuthModule } from './auth/auth.module.js'
import { ProfileModule } from './profile/profile.module.js'

/**
 * Root application module.
 * Registers `ConfigModule` globally so every module can inject `ConfigService`
 * without re-importing. The Zod-backed `validateEnv` function runs at startup
 * and terminates the process if required env vars are absent.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        uri: config.get('MONGODB_URI'),
        dbName: config.get('MONGODB_DB_NAME'),
      }),
    }),
    GithubModule,
    AuthModule,
    ProfileModule,
  ],
})
export class AppModule {}
