import { IsOptional, IsString, ValidateIf } from 'class-validator'

export class GenerateCodingRulesDto {
  @IsOptional()
  @IsString()
  userId?: string

  @IsOptional()
  @IsString()
  username?: string

  // At least one of userId or username must be present.
  @ValidateIf((o: GenerateCodingRulesDto) => !o.userId && !o.username)
  @IsString({ message: 'At least one of userId or username is required' })
  readonly _atLeastOne?: never
}
