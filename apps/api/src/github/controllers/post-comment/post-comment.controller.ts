import 'reflect-metadata'
import { Controller, Post, Body, Inject } from '@nestjs/common'
import { PostCommentService } from '../../services/post-comment.service.js'
import { PostCommentDto } from './post-comment.dto.js'

interface CommentResult {
  commentId: number
  url: string
}

// TODO: Add API authentication for /api/* routes (e.g. shared Bearer token or
// mTLS for service-to-service calls). Currently protected by Clerk auth only.

/** `POST /api/comments` */
@Controller()
export class PostCommentController {
  constructor(@Inject(PostCommentService) private readonly service: PostCommentService) {}

  @Post('api/comments')
  postComment(@Body() dto: PostCommentDto): Promise<CommentResult> {
    return this.service.execute(dto)
  }
}
