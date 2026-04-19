import { IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator'

export class RunReviewInput {
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

export class GeneratePreferencesInput {
  // No body fields needed — profileId comes from route param
}
