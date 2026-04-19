import { z } from 'zod'

const envSchema = z.object({
  GITHUB_TOKEN: z.string().min(1, 'GITHUB_TOKEN is required'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  MONGODB_DB_NAME: z.string().min(1, 'MONGODB_DB_NAME is required'),
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),
  PORT: z.coerce.number().int().positive().default(3000),
  WEBHOOK_SECRET: z.string().min(1, 'WEBHOOK_SECRET is required'),
  /** Optional — if absent, Guard runs in no-op mode (all requests allowed). */
  CLERK_SECRET_KEY: z.string().optional(),
  /** Optional — if absent, avatar pixelization and Vercel Blob upload are skipped. */
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  // ── GitHub App integration ──────────────────────────────────────────────────
  GITHUB_APP_ID: z.coerce.number().int().positive(),
  GITHUB_APP_CLIENT_ID: z.string().min(1),
  GITHUB_APP_CLIENT_SECRET: z.string().min(1),
  /**
   * PEM private key with newlines escaped as \n.
   * Required unless GITHUB_APP_PRIVATE_KEY_PATH is set instead.
   */
  GITHUB_APP_PRIVATE_KEY: z.string().optional(),
  /** Path to a PEM file on disk — alternative to inlining the key. */
  GITHUB_APP_PRIVATE_KEY_PATH: z.string().optional(),
  /** Separate from WEBHOOK_SECRET — this secret covers GitHub App deliveries. */
  GITHUB_APP_WEBHOOK_SECRET: z.string().min(1),
  /** The app slug from github.com/apps/<slug>. Used to build the install URL. */
  GITHUB_APP_SLUG: z.string().min(1),
  /** Canonical public base URL, e.g. https://talk.withrevi.dev */
  PUBLIC_URL: z.string().min(1),
  /** 32 random bytes encoded as base64 — used for AES-256-GCM token encryption. */
  TOKEN_ENCRYPTION_KEY: z.string().min(1),
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
