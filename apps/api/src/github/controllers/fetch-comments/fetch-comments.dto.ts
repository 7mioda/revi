import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator'

export class FetchCommentsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  repos?: string[]

  @IsOptional()
  @IsInt()
  @Min(1)
  maxPages?: number
}
