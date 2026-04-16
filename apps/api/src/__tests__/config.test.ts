import { describe, it, expect } from 'vitest'
import { validateEnv } from '../config.js'

describe('validateEnv', () => {
  it('returns parsed config when GITHUB_TOKEN is present', () => {
    const result = validateEnv({ GITHUB_TOKEN: 'ghp_test', PORT: '4000' })
    expect(result.GITHUB_TOKEN).toBe('ghp_test')
    expect(result.PORT).toBe(4000)
  })

  it('uses PORT default of 3000 when not set', () => {
    const result = validateEnv({ GITHUB_TOKEN: 'ghp_test' })
    expect(result.PORT).toBe(3000)
  })

  it('throws when GITHUB_TOKEN is missing', () => {
    expect(() => validateEnv({})).toThrow()
  })
})
