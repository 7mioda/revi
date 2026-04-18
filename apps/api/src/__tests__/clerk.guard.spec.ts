import 'reflect-metadata'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UnauthorizedException } from '@nestjs/common'

// Must be hoisted — vi.mock is statically analysed by Vitest
vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
}))

import { verifyToken } from '@clerk/backend'
import { ClerkGuard } from '../auth/clerk.guard.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(secretKey: string | undefined) {
  return {
    get: vi.fn().mockReturnValue(secretKey),
  }
}

function makeReflector(isPublic: boolean) {
  return {
    getAllAndOverride: vi.fn().mockReturnValue(isPublic),
  }
}

function makeContext(headers: Record<string, string> = {}) {
  const req = { headers, clerkUserId: null as string | null }
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: vi.fn(),
    getClass: vi.fn(),
    req,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ClerkGuard', () => {
  beforeEach(() => {
    vi.mocked(verifyToken).mockReset()
  })

  describe('no-op mode (CLERK_SECRET_KEY not set)', () => {
    it('allows any request and sets clerkUserId to null', async () => {
      const guard = new ClerkGuard(makeConfig(undefined) as never, makeReflector(false) as never)
      const ctx = makeContext()
      const result = await guard.canActivate(ctx as never)
      expect(result).toBe(true)
      expect(ctx.req.clerkUserId).toBeNull()
    })
  })

  describe('@Public() routes', () => {
    it('allows unauthenticated requests even when key is set', async () => {
      const guard = new ClerkGuard(makeConfig('sk_test_123') as never, makeReflector(true) as never)
      const ctx = makeContext()
      const result = await guard.canActivate(ctx as never)
      expect(result).toBe(true)
    })
  })

  describe('key set, no Authorization header', () => {
    it('throws UnauthorizedException', async () => {
      const guard = new ClerkGuard(makeConfig('sk_test_123') as never, makeReflector(false) as never)
      const ctx = makeContext()
      await expect(guard.canActivate(ctx as never)).rejects.toThrow(UnauthorizedException)
    })
  })

  describe('key set, invalid token', () => {
    it('throws UnauthorizedException', async () => {
      vi.mocked(verifyToken).mockRejectedValue(new Error('invalid token'))
      const guard = new ClerkGuard(makeConfig('sk_test_123') as never, makeReflector(false) as never)
      const ctx = makeContext({ authorization: 'Bearer bad-token' })
      await expect(guard.canActivate(ctx as never)).rejects.toThrow(UnauthorizedException)
    })
  })

  describe('key set, valid token', () => {
    it('sets clerkUserId to the sub claim and returns true', async () => {
      vi.mocked(verifyToken).mockResolvedValue({ sub: 'user_abc123' } as never)
      const guard = new ClerkGuard(makeConfig('sk_test_123') as never, makeReflector(false) as never)
      const ctx = makeContext({ authorization: 'Bearer valid-token' })
      const result = await guard.canActivate(ctx as never)
      expect(result).toBe(true)
      expect(ctx.req.clerkUserId).toBe('user_abc123')
    })
  })
})
