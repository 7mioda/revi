import type { PreferenceEntity } from '../entities/preference.js'

export function buildPreference(overrides: Partial<PreferenceEntity> = {}): PreferenceEntity {
  return {
    id: '000000000000000000000001',
    name: 'prefers-small-prs',
    dimension: 'collaboration',
    content: 'Prefers small, focused pull requests over large omnibus ones.',
    tags: ['pull-requests', 'code-review'],
    evolution: null,
    batchId: 'batch-001',
    generatedAt: new Date().toISOString(),
    userId: null,
    username: null,
    ...overrides,
  }
}
