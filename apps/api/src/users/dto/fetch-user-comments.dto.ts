import { IsString, MinLength } from 'class-validator'

export class FetchUserCommentsDto {
  @IsString()
  @MinLength(1)
  username!: string
}
