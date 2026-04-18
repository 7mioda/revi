import { z } from 'zod'

const envSchema = z.object({
  GITHUB_TOKEN: z.string().min(1, 'GITHUB_TOKEN is required'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  MONGODB_DB_NAME: z.string().min(1, 'MONGODB_DB_NAME is required'),
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),
  PORT: z.coerce.number().int().positive().default(3000),
  WEBHOOK_SECRET: z.string().min(1, 'WEBHOOK_SECRET is required'),
  /** Optional — if absent, Novu notifications are silently skipped. */
  NOVU_API_KEY: z.string().optional(),
  /** Optional — if absent, ClerkGuard runs in no-op mode (all requests allowed). */
  CLERK_SECRET_KEY: z.string().optional(),
})

/** Parsed, validated environment configuration. */
export type Env = z.infer<typeof envSchema>

/**
 * Validates raw environment variables against the schema.
 * Throws a `ZodError` (with a human-readable message) if any required
 * variable is missing or malformed. Intended for use in `ConfigModule.forRoot`.
 *
 * @param config - Raw `process.env`-like record (injected by NestJS ConfigModule).
 * @returns A validated and typed `Env` object.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config)
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${result.error.toString()}`)
  }
  return result.data
}
