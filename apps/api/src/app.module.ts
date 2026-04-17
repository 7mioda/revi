import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { MongooseModule } from '@nestjs/mongoose'
import { validateEnv } from './config.js'
import type { Env } from './config.js'
import { GithubModule } from './github/github.module.js'
import { MeModule } from './me/me.module.js'
import { SkillsModule } from './skills/skills.module.js'
import { ReviewsModule } from './reviews/reviews.module.js'
import { WebhookModule } from './webhook/webhook.module.js'
import { UsersModule } from './users/users.module.js'

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
      }),
    }),
    GithubModule,
    MeModule,
    SkillsModule,
    ReviewsModule,
    WebhookModule,
    UsersModule,
  ],
})
export class AppModule {}
