import { IsString, IsOptional } from 'class-validator'

export class CreateProfileInput {
  @IsString()
  username!: string

  @IsString()
  @IsOptional()
  token?: string
}

export class RetryProfileInput {
  @IsString()
  jobId!: string

  @IsString()
  @IsOptional()
  token?: string
}
