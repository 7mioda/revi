import { describe, it, expect, vi } from 'vitest'
import type { OctokitClient } from '../client.js'

function makeMockClient(paginate: OctokitClient['paginate']): OctokitClient {
  return {
    paginate,
    rest: { pulls: { listFiles: vi.fn() } },
  } as unknown as OctokitClient
}

describe('fetchPRDiff', () => {
  it('maps raw API items to PRFile objects', async () => {
    const { fetchPRDiff } = await import('../fetch-pr-diff.js')
    const raw = [
      { filename: 'src/foo.ts', status: 'modified', patch: '@@ -1 +1 @@\n-old\n+new' },
      { filename: 'src/bar.ts', status: 'added', patch: '@@ -0,0 +1 @@\n+added' },
    ]
    const client = makeMockClient(vi.fn().mockResolvedValue(raw))

    const result = await fetchPRDiff(client, 'owner', 'repo', 42)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ filename: 'src/foo.ts', status: 'modified', patch: '@@ -1 +1 @@\n-old\n+new' })
    expect(result[1]).toEqual({ filename: 'src/bar.ts', status: 'added', patch: '@@ -0,0 +1 @@\n+added' })
  })

  it('omits patch when the file has no diff (binary or too large)', async () => {
    const { fetchPRDiff } = await import('../fetch-pr-diff.js')
    const raw = [{ filename: 'image.png', status: 'added', patch: undefined }]
    const client = makeMockClient(vi.fn().mockResolvedValue(raw))

    const result = await fetchPRDiff(client, 'owner', 'repo', 1)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ filename: 'image.png', status: 'added' })
    expect(result[0]).not.toHaveProperty('patch')
  })

  it('paginates using client.paginate with the correct endpoint and params', async () => {
    const { fetchPRDiff } = await import('../fetch-pr-diff.js')
    const paginate = vi.fn().mockResolvedValue([])
    const client = makeMockClient(paginate)

    await fetchPRDiff(client, 'myorg', 'myrepo', 99)

    expect(paginate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ owner: 'myorg', repo: 'myrepo', pull_number: 99, per_page: 100 }),
    )
  })

  it('returns an empty array when the PR has no changed files', async () => {
    const { fetchPRDiff } = await import('../fetch-pr-diff.js')
    const client = makeMockClient(vi.fn().mockResolvedValue([]))

    const result = await fetchPRDiff(client, 'o', 'r', 1)

    expect(result).toEqual([])
  })
})
