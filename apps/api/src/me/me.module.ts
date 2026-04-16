import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MeController } from './me.controller.js'
import { MeService } from './me.service.js'
import { Comment, CommentSchema } from './comment.schema.js'

/**
 * Encapsulates the token-authenticated "me" endpoints and the Mongoose
 * model for persisted comments.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Comment.name, schema: CommentSchema }]),
  ],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
