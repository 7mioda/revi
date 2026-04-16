import { IsInt, IsOptional, Max, Min } from 'class-validator'

export class GenerateSkillsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  sampleSize?: number
}
