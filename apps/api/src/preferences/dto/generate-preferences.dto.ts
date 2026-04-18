import { IsOptional, IsString, ValidateIf } from 'class-validator'

export class GeneratePreferencesDto {
  @IsOptional()
  @IsString()
  userId?: string

  @IsOptional()
  @IsString()
  username?: string

  // At least one of userId or username must be present.
  @ValidateIf((o: GeneratePreferencesDto) => !o.userId && !o.username)
  @IsString({ message: 'At least one of userId or username is required' })
  readonly _atLeastOne?: never
}
