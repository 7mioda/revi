import { createHmac, randomBytes } from 'node:crypto'
import { describe, it, expect } from 'vitest'
import { encryptToken, decryptToken, verifyWebhookSignature } from '../github/lib/crypto.js'
import { generateState, signState, verifyState } from '../github/lib/state.js'

function makeHmac(body: Buffer, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
}

// ── encryptToken / decryptToken ────────────────────────────────────────────

describe('encryptToken / decryptToken', () => {
  const key = randomBytes(32).toString('base64')

  it('round-trips correctly', () => {
    expect(decryptToken(encryptToken('my-secret-token', key), key)).toBe('my-secret-token')
  })

  it('round-trips an empty string', () => {
    expect(decryptToken(encryptToken('', key), key)).toBe('')
  })

  it('produces different ciphertexts for the same input (random IV)', () => {
    expect(encryptToken('same', key)).not.toBe(encryptToken('same', key))
  })

  it('throws when the ciphertext segment is tampered', () => {
    const enc = encryptToken('secret', key)
    const parts = enc.split(':')
    const tampered = [parts[0], parts[1], 'deadbeef'].join(':')
    expect(() => decryptToken(tampered, key)).toThrow()
  })

  it('throws when the auth tag is tampered', () => {
    const enc = encryptToken('secret', key)
    const parts = enc.split(':')
    const tampered = [parts[0], 'a'.repeat(32), parts[2]].join(':')
    expect(() => decryptToken(tampered, key)).toThrow()
  })

  it('throws when the wrong key is used', () => {
    const enc = encryptToken('secret', key)
    const wrongKey = randomBytes(32).toString('base64')
    expect(() => decryptToken(enc, wrongKey)).toThrow()
  })

  it('throws on malformed input (wrong number of segments)', () => {
    expect(() => decryptToken('not-a-valid-format', key)).toThrow()
  })
})

// ── verifyWebhookSignature ─────────────────────────────────────────────────

describe('verifyWebhookSignature', () => {
  const secret = 'webhook-secret'
  const body = Buffer.from('{"action":"opened"}')

  it('accepts a valid signature', () => {
    expect(() => verifyWebhookSignature(body, makeHmac(body, secret), secret)).not.toThrow()
  })

  it('throws when the signature header is missing', () => {
    expect(() => verifyWebhookSignature(body, undefined, secret)).toThrow()
  })

  it('throws when the body has been tampered', () => {
    const sig = makeHmac(body, secret)
    expect(() => verifyWebhookSignature(Buffer.from('tampered'), sig, secret)).toThrow()
  })

  it('throws when the wrong secret is used to sign', () => {
    const sig = makeHmac(body, 'wrong-secret')
    expect(() => verifyWebhookSignature(body, sig, secret)).toThrow()
  })
})

// ── generateState / signState / verifyState ────────────────────────────────

describe('generateState / signState / verifyState', () => {
  const key = randomBytes(32).toString('base64')

  it('generates a non-empty URL-safe string', () => {
    const state = generateState()
    expect(state).toBeTruthy()
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('round-trips: verifyState returns the original nonce', () => {
    const nonce = generateState()
    const signed = signState(nonce, key)
    expect(verifyState(signed, key)).toBe(nonce)
  })

  it('throws when the signature segment is tampered', () => {
    const signed = signState(generateState(), key)
    const parts = signed.split('.')
    const tampered = [parts[0], parts[1], 'badhex000000'].join('.')
    expect(() => verifyState(tampered, key)).toThrow()
  })

  it('throws when the nonce segment is tampered', () => {
    const signed = signState(generateState(), key)
    const parts = signed.split('.')
    const tampered = ['differentnonce', parts[1], parts[2]].join('.')
    expect(() => verifyState(tampered, key)).toThrow()
  })

  it('throws when the wrong key is used', () => {
    const signed = signState(generateState(), key)
    const wrongKey = randomBytes(32).toString('base64')
    expect(() => verifyState(signed, wrongKey)).toThrow()
  })

  it('throws on malformed input (wrong number of segments)', () => {
    expect(() => verifyState('only.two', key)).toThrow()
  })
})
