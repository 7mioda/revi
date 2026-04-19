import { createHmac } from 'node:crypto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReceiveWebhookController } from '../github/controllers/receive-webhook/receive-webhook.controller.js'
import type { GithubAppClientService } from '../github/infrastructure/octokit/github-app-client.service.js'
import type { ProcessWebhookService } from '../github/services/process-webhook.service.js'

// ── helpers ────────────────────────────────────────────────────────────────

const WEBHOOK_SECRET = 'test-webhook-secret'

function makeHmac(body: Buffer): string {
  return 'sha256=' + createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex')
}

function makeController(overrides: {
  verifyWebhookSignature?: ReturnType<typeof vi.fn>
  processWebhook?: Partial<ProcessWebhookService>
} = {}): ReceiveWebhookController {
  const client = {
    verifyWebhookSignature: overrides.verifyWebhookSignature ?? vi.fn(),
  } as unknown as GithubAppClientService

  const processWebhook = {
    execute: vi.fn().mockResolvedValue(undefined),
    ...overrides.processWebhook,
  } as unknown as ProcessWebhookService

  return new ReceiveWebhookController(client, processWebhook)
}

function makeReq(body: unknown, rawBody: Buffer, headers: Record<string, string | undefined> = {}) {
  return {
    rawBody,
    body,
    headers: {
      'x-github-delivery': 'delivery-abc-123',
      'x-github-event': 'push',
      'x-hub-signature-256': makeHmac(rawBody),
      ...headers,
    },
  } as unknown as import('express').Request & { rawBody: Buffer }
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('ReceiveWebhookController — POST /webhooks/github', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns { ok: true } and fires processWebhook.execute for a valid delivery', () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const controller = makeController({ processWebhook: { execute } })
    const body = { action: 'opened' }
    const raw = Buffer.from(JSON.stringify(body))
    const req = makeReq(body, raw)

    const result = controller.webhook(req as never)

    expect(result).toEqual({ ok: true })
    expect(execute).toHaveBeenCalledWith('delivery-abc-123', 'push', body)
  })

  it('propagates signature verification errors (simulating 403 on bad signature)', () => {
    const controller = makeController({
      verifyWebhookSignature: vi.fn().mockImplementation(() => {
        throw new Error('Invalid webhook signature')
      }),
    })
    const raw = Buffer.from('{}')
    const req = makeReq({}, raw, { 'x-hub-signature-256': 'sha256=badhash' })

    expect(() => controller.webhook(req as never)).toThrow('Invalid webhook signature')
  })

  it('does NOT call processWebhook.execute when verification throws', () => {
    const execute = vi.fn()
    const controller = makeController({
      verifyWebhookSignature: vi.fn().mockImplementation(() => {
        throw new Error('bad sig')
      }),
      processWebhook: { execute },
    })
    const raw = Buffer.from('{}')

    try {
      controller.webhook(makeReq({}, raw) as never)
    } catch {
      // expected
    }

    expect(execute).not.toHaveBeenCalled()
  })

  it('still returns { ok: true } for a duplicate delivery (idempotency handled in service)', () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const controller = makeController({ processWebhook: { execute } })
    const raw = Buffer.from('{}')

    const result = controller.webhook(makeReq({}, raw) as never)

    expect(result).toEqual({ ok: true })
    expect(execute).toHaveBeenCalledOnce()
  })
})
