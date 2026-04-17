import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export class GenerateSkillsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  sampleSize?: number

  @IsOptional()
  @IsString()
  userId?: string

  @IsOptional()
  @IsString()
  username?: string
}
