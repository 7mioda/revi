import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { validateEnv } from './config.js'
import { GithubModule } from './github/github.module.js'

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
    GithubModule,
  ],
})
export class AppModule {}
