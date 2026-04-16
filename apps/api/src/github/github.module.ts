import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { GithubController } from './github.controller.js'
import { GithubService } from './github.service.js'

/**
 * Encapsulates all GitHub-related HTTP wiring.
 * Exports `GithubService` so other modules can use it if needed in future.
 */
@Module({
  controllers: [GithubController],
  providers: [GithubService],
  exports: [GithubService],
})
export class GithubModule {}
