import { IsOptional, IsString } from 'class-validator'

export class SyncProfileDto {
  @IsOptional()
  @IsString()
  token?: string
}
