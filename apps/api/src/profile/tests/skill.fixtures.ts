import { buildSkill } from '../factories/skill.factory.js'
import type { SkillEntity } from '../entities/index.js'

export const fixtureSkill: SkillEntity = buildSkill({
  id: 'skill-1',
  username: 'alice',
  name: 'Async Error Handling',
  content: 'Always use try/catch with async/await.',
  tags: ['error-handling', 'async'],
  dimension: 'review-style',
})

export const fixtureSkill2: SkillEntity = buildSkill({
  id: 'skill-2',
  username: 'alice',
  name: 'Type Safety',
  content: 'Avoid using `any`. Prefer `unknown` with type guards.',
  tags: ['typescript', 'types'],
  dimension: 'code-quality',
})
