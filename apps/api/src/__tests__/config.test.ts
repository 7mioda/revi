import { describe, it, expect } from 'vitest'
import { validateEnv } from '../config.js'

const validEnv = {
  GITHUB_TOKEN: 'ghp_test',
  MONGODB_URI: 'mongodb://localhost/test',
  ANTHROPIC_API_KEY: 'sk-ant-test',
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

  it('throws when GITHUB_TOKEN is missing', () => {
    expect(() => validateEnv({})).toThrow()
  })
})
