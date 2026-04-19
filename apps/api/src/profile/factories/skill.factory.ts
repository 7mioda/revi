import type { SkillEntity } from '../entities/skill.js'

export function buildSkill(overrides: Partial<SkillEntity> = {}): SkillEntity {
  return {
    id: '000000000000000000000001',
    name: 'review-style',
    content: 'Be direct and concise in code review comments.',
    tags: ['code-review'],
    batchId: 'batch-001',
    generatedAt: new Date().toISOString(),
    userId: null,
    username: null,
    dimension: 'review-style',
    ...overrides,
  }
}
