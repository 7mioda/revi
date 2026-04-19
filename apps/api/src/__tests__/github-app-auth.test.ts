import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BadRequestException } from '@nestjs/common'
import { InstallController } from '../github/controllers/install/install.controller.js'
import { GithubCallbackController } from '../github/controllers/github-callback/github-callback.controller.js'
import type { GithubAppClientService } from '../github/infrastructure/octokit/github-app-client.service.js'
import type { HandleInstallCallbackService } from '../github/services/handle-install-callback.service.js'
import type { HandleOAuthCallbackService } from '../github/services/handle-oauth-callback.service.js'
import type { HandleCombinedCallbackService } from '../github/services/handle-combined-callback.service.js'

// ── helpers ────────────────────────────────────────────────────────────────

function makeInstallController(
  getInstallUrl = vi.fn().mockReturnValue('https://github.com/apps/revi/installations/new?state=signed'),
): InstallController {
  const client = { getInstallUrl } as unknown as GithubAppClientService
  return new InstallController(client)
}

function makeCallbackController(overrides: {
  verifyCallbackState?: ReturnType<typeof vi.fn>
  handleInstall?: Partial<HandleInstallCallbackService>
  handleOAuth?: Partial<HandleOAuthCallbackService>
  handleCombined?: Partial<HandleCombinedCallbackService>
} = {}): GithubCallbackController {
  const client = {
    verifyCallbackState: overrides.verifyCallbackState ?? vi.fn(),
  } as unknown as GithubAppClientService

  const handleInstall = {
    execute: vi.fn().mockResolvedValue(undefined),
    ...overrides.handleInstall,
  } as unknown as HandleInstallCallbackService

  const handleOAuth = {
    execute: vi.fn().mockResolvedValue({ userId: 42, login: 'alice' }),
    ...overrides.handleOAuth,
  } as unknown as HandleOAuthCallbackService

  const handleCombined = {
    execute: vi.fn().mockResolvedValue({ userId: 42, login: 'alice' }),
    ...overrides.handleCombined,
  } as unknown as HandleCombinedCallbackService

  return new GithubCallbackController(client, handleInstall, handleOAuth, handleCombined)
}

// ── install redirect ───────────────────────────────────────────────────────

describe('InstallController — GET /auth/github/install', () => {
  it('returns the GitHub install URL from the client service', () => {
    const controller = makeInstallController()
    const result = controller.install()
    expect(result.url).toContain('github.com/apps')
  })
})

// ── OAuth callback dispatch ────────────────────────────────────────────────

describe('GithubCallbackController — GET /auth/github', () => {
  beforeEach(() => vi.clearAllMocks())

  it('Case 1: post-install only — calls handleInstall.execute when only installation_id is present', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const controller = makeCallbackController({ handleInstall: { execute } })

    const result = await controller.callback({
      installation_id: '99',
      setup_action: 'install',
      state: 'valid-state',
    })

    expect(execute).toHaveBeenCalledWith(99)
    expect(result.ok).toBe(true)
  })

  it('Case 2: OAuth only — calls handleOAuth.execute when only code is present', async () => {
    const execute = vi.fn().mockResolvedValue({ userId: 1, login: 'bob' })
    const controller = makeCallbackController({ handleOAuth: { execute } })

    const result = await controller.callback({ code: 'gh-code-xyz', state: 'valid-state' })

    expect(execute).toHaveBeenCalledWith('gh-code-xyz')
    expect(result.ok).toBe(true)
    expect(result.message).toContain('bob')
  })

  it('Case 3: combined — calls handleCombined.execute when both code and installation_id are present', async () => {
    const execute = vi.fn().mockResolvedValue({ userId: 7, login: 'carol' })
    const controller = makeCallbackController({ handleCombined: { execute } })

    const result = await controller.callback({
      code: 'gh-code-abc',
      installation_id: '55',
      setup_action: 'install',
      state: 'valid-state',
    })

    expect(execute).toHaveBeenCalledWith('gh-code-abc', 55)
    expect(result.ok).toBe(true)
    expect(result.message).toContain('carol')
  })

  it('returns ok: false when neither code nor installation_id is present', async () => {
    const controller = makeCallbackController()
    const result = await controller.callback({ state: 'valid-state' })
    expect(result.ok).toBe(false)
  })

  it('propagates BadRequestException when state verification fails', async () => {
    const controller = makeCallbackController({
      verifyCallbackState: vi.fn().mockImplementation(() => {
        throw new BadRequestException('Invalid or expired state')
      }),
    })

    await expect(
      controller.callback({ code: 'some-code', state: 'bad-state' }),
    ).rejects.toThrow(BadRequestException)
  })

  it('propagates BadRequestException when state is missing', async () => {
    const controller = makeCallbackController({
      verifyCallbackState: vi.fn().mockImplementation(() => {
        throw new BadRequestException('Missing state parameter')
      }),
    })

    await expect(controller.callback({})).rejects.toThrow(BadRequestException)
  })
})
