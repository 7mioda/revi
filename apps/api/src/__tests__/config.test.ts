import { describe, it, expect } from 'vitest'
import { validateEnv } from '../config.js'

const validEnv = {
  GITHUB_TOKEN: 'ghp_test',
  MONGODB_URI: 'mongodb://localhost/test',
  MONGODB_DB_NAME: 'testdb',
  ANTHROPIC_API_KEY: 'sk-ant-test',
  WEBHOOK_SECRET: 'whsec_test',
  // GitHub App fields
  GITHUB_APP_ID: '12345',
  GITHUB_APP_CLIENT_ID: 'Iv1.abc123',
  GITHUB_APP_CLIENT_SECRET: 'client_secret',
  GITHUB_APP_WEBHOOK_SECRET: 'app_webhook_secret',
  GITHUB_APP_SLUG: 'revi',
  PUBLIC_URL: 'https://talk.withrevi.dev',
  TOKEN_ENCRYPTION_KEY: 'dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleXRlc3Q=',
}

describe('validateEnv', () => {
  it('returns parsed config when all required vars are present', () => {
    const result = validateEnv({ ...validEnv, PORT: '4000' })
    expect(result.GITHUB_TOKEN).toBe('ghp_test')
    expect(result.MONGODB_URI).toBe('mongodb://localhost/test')
    expect(result.ANTHROPIC_API_KEY).toBe('sk-ant-test')
    expect(result.PORT).toBe(4000)
  })

  it('uses PORT default of 3000 when not set', () => {
    const result = validateEnv(validEnv)
    expect(result.PORT).toBe(3000)
  })

  it('coerces GITHUB_APP_ID string to number', () => {
    const result = validateEnv(validEnv)
    expect(result.GITHUB_APP_ID).toBe(12345)
    expect(typeof result.GITHUB_APP_ID).toBe('number')
  })

  it('throws when GITHUB_TOKEN is missing', () => {
    const { GITHUB_TOKEN: _, ...rest } = validEnv
    expect(() => validateEnv(rest)).toThrow()
  })

  it('throws when GITHUB_APP_ID is missing', () => {
    const { GITHUB_APP_ID: _, ...rest } = validEnv
    expect(() => validateEnv(rest)).toThrow()
  })

  it('throws when TOKEN_ENCRYPTION_KEY is missing', () => {
    const { TOKEN_ENCRYPTION_KEY: _, ...rest } = validEnv
    expect(() => validateEnv(rest)).toThrow()
  })

  it('allows optional fields to be absent', () => {
    const result = validateEnv(validEnv)
    expect(result.CLERK_SECRET_KEY).toBeUndefined()
    expect(result.GITHUB_APP_PRIVATE_KEY).toBeUndefined()
    expect(result.GITHUB_APP_PRIVATE_KEY_PATH).toBeUndefined()
  })
})
