import { describe, it, expect, vi } from 'vitest'
import type { OctokitClient } from '../client.js'

function makeMockClient(overrides: {
  getAuthenticated?: () => Promise<{ data: unknown }>
  paginate?: OctokitClient['paginate']
}): OctokitClient {
  return {
    rest: {
      users: {
        getAuthenticated: overrides.getAuthenticated ?? vi.fn(),
      },
      repos: {
        listForAuthenticatedUser: vi.fn(),
      },
    },
    paginate: overrides.paginate ?? vi.fn().mockResolvedValue([]),
  } as unknown as OctokitClient
}

describe('getAuthenticatedUser', () => {
  it('returns login and id from GET /user', async () => {
    const { getAuthenticatedUser } = await import('../get-authenticated-user.js')
    const client = makeMockClient({
      getAuthenticated: vi.fn().mockResolvedValue({
        data: { login: 'alice', id: 42 },
      }),
    })

    const result = await getAuthenticatedUser(client)

    expect(result).toEqual({ login: 'alice', id: 42 })
  })
})

describe('listAccessibleRepos', () => {
  it('paginates GET /user/repos and maps to RepoRef[]', async () => {
    const { listAccessibleRepos } = await import('../list-accessible-repos.js')
    const raw = [
      { owner: { login: 'alice' }, name: 'my-repo' },
      { owner: { login: 'org' }, name: 'org-repo' },
    ]
    const client = makeMockClient({
      paginate: vi.fn().mockResolvedValue(raw),
    })

    const result = await listAccessibleRepos(client)

    expect(result).toEqual([
      { owner: 'alice', name: 'my-repo' },
      { owner: 'org', name: 'org-repo' },
    ])
  })

  it('uses all three affiliation types in the request', async () => {
    const { listAccessibleRepos } = await import('../list-accessible-repos.js')
    const paginate = vi.fn().mockResolvedValue([])
    const client = makeMockClient({ paginate })

    await listAccessibleRepos(client)

    expect(paginate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ affiliation: 'owner,collaborator,organization_member' }),
    )
  })
})
