import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator'

export class PostCommentDto {
  @IsInt()
  @Min(1)
  installationId!: number

  @IsString()
  owner!: string

  @IsString()
  repo!: string

  @IsInt()
  @Min(1)
  issueNumber!: number

  @IsString()
  body!: string

  @IsIn(['app', 'user'])
  as!: 'app' | 'user'

  /**
   * Required when `as` is `"user"`. The GitHub user ID of the commenter
   * whose stored OAuth token will be used to post the comment.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  userId?: number
}
