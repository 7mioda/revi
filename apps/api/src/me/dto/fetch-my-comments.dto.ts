import { IsString, MinLength } from 'class-validator'

/**
 * Request body for `POST /me/comments`.
 */
export class FetchMyCommentsDto {
  /** GitHub personal access token used to authenticate the request. */
  @IsString()
  @MinLength(1)
  token!: string
}
