import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { HttpException, HttpStatus } from '@nestjs/common'

const IV_BYTES = 12   // 96-bit IV — required by AES-256-GCM
const TAG_BYTES = 16  // 128-bit auth tag

/**
 * Encrypts a plaintext string with AES-256-GCM.
 *
 * @param plaintext - The string to encrypt.
 * @param keyBase64 - 32-byte key encoded as base64.
 * @returns A colon-separated string: `iv:authTag:ciphertext` (all hex).
 */
export function encryptToken(plaintext: string, keyBase64: string): string {
  const key = Buffer.from(keyBase64, 'base64')
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':')
}

/**
 * Decrypts a value produced by {@link encryptToken}.
 *
 * @throws If the ciphertext has been tampered with or the key is wrong.
 */
export function decryptToken(encrypted: string, keyBase64: string): string {
  const parts = encrypted.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted token format')
  const [ivHex, tagHex, dataHex] = parts as [string, string, string]

  const key = Buffer.from(keyBase64, 'base64')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const data = Buffer.from(dataHex, 'hex')

  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

/**
 * Verifies the `X-Hub-Signature-256` header of a GitHub webhook delivery.
 * Uses `timingSafeEqual` to prevent timing attacks.
 *
 * @throws `HttpException(403)` if the signature is absent or invalid.
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string | undefined,
  secret: string,
): void {
  if (!signature) {
    throw new HttpException('Missing X-Hub-Signature-256', HttpStatus.FORBIDDEN)
  }

  const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex')
  const expectedBuf = Buffer.from(expected, 'utf8')
  const receivedBuf = Buffer.from(signature, 'utf8')

  const valid =
    expectedBuf.length === receivedBuf.length && timingSafeEqual(expectedBuf, receivedBuf)

  if (!valid) {
    throw new HttpException('Invalid webhook signature', HttpStatus.FORBIDDEN)
  }
}

// Suppress TS unused warning — TAG_BYTES is a documentation constant
void TAG_BYTES
