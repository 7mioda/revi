import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * HMAC context string — included in the signed payload so signatures from this
 * module can't be replayed in a different context even if the key is shared.
 */
const HMAC_CONTEXT = 'github-oauth-state-v1'

/** OAuth state tokens are valid for 10 minutes. */
const TTL_MS = 10 * 60 * 1000

/**
 * Generates a random, URL-safe state nonce (22 base64url characters).
 */
export function generateState(): string {
  return randomBytes(16).toString('base64url')
}

/**
 * Signs a state nonce, embedding a timestamp so the token self-expires.
 *
 * Format: `<nonce>.<timestamp_base36>.<hmac_hex>`
 * All three components are free of dots, so splitting on `.` always yields
 * exactly three parts.
 *
 * @param nonce - A URL-safe nonce, typically from {@link generateState}.
 * @param keyBase64 - 32-byte HMAC key encoded as base64.
 */
export function signState(nonce: string, keyBase64: string): string {
  const timestamp = Date.now().toString(36)
  const payload = `${nonce}.${timestamp}`
  const sig = createHmac('sha256', Buffer.from(keyBase64, 'base64'))
    .update(`${HMAC_CONTEXT}:${payload}`)
    .digest('hex')
  return `${payload}.${sig}`
}

/**
 * Verifies a signed state token and returns the original nonce.
 *
 * @throws `Error('invalid state')` if the signature is wrong, the format is
 *   malformed, or the token has expired (> 10 minutes old).
 */
export function verifyState(signed: string, keyBase64: string): string {
  const parts = signed.split('.')
  if (parts.length !== 3) throw new Error('invalid state')
  const [nonce, timestamp, sig] = parts as [string, string, string]

  const payload = `${nonce}.${timestamp}`
  const expected = createHmac('sha256', Buffer.from(keyBase64, 'base64'))
    .update(`${HMAC_CONTEXT}:${payload}`)
    .digest('hex')

  const sigBuf = Buffer.from(sig, 'hex')
  const expectedBuf = Buffer.from(expected, 'hex')

  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    throw new Error('invalid state')
  }

  const ts = parseInt(timestamp, 36)
  if (Date.now() - ts > TTL_MS) throw new Error('invalid state')

  return nonce
}
