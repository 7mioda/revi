import { IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator'

export class CreateReviewDto {
  @IsString()
  @MinLength(1)
  owner!: string

  @IsString()
  @MinLength(1)
  repo!: string

  @IsInt()
  @Min(1)
  pullNumber!: number

  @IsOptional()
  @IsBoolean()
  post?: boolean
}
