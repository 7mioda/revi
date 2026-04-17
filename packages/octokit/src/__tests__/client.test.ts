import { describe, it, expect } from 'vitest'
import { createOctokitClient } from '../client.js'

describe('createOctokitClient', () => {
  it('returns a client with request and paginate methods', () => {
    const client = createOctokitClient('test-token')
    expect(typeof client.request).toBe('function')
    expect(typeof client.paginate).toBe('function')
  })

  it('exposes REST helpers with pulls, issues, and repos namespaces', () => {
    const client = createOctokitClient('test-token')
    expect(typeof client.rest.pulls.listReviewComments).toBe('function')
    expect(typeof client.rest.issues.listCommentsForRepo).toBe('function')
    expect(typeof client.rest.repos.listCommitCommentsForRepo).toBe('function')
    expect(typeof client.rest.repos.listForUser).toBe('function')
  })

  it('creates an anonymous client when no token is provided', () => {
    const client = createOctokitClient()
    expect(typeof client.request).toBe('function')
    expect(typeof client.paginate).toBe('function')
  })

  it('creates an anonymous client when token is undefined', () => {
    const client = createOctokitClient(undefined)
    expect(typeof client.paginate).toBe('function')
  })
})
