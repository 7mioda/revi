import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator'

/**
 * Request body for `POST /github/:username/comments`.
 * All fields are optional — omitting `repos` triggers auto-discovery.
 */
export class FetchCommentsDto {
  /**
   * Restrict fetching to these repositories (format: `"owner/repo"`).
   * If omitted, all repos owned by the username are used.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  repos?: string[]

  /**
   * Maximum number of pages to fetch per comment source per repository.
   * If omitted, all pages are fetched.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPages?: number
}
