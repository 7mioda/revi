export interface SkillEntity {
  id: string
  name: string
  content: string
  tags: string[]
  /** UUID shared by all skills generated in the same batch. */
  batchId: string
  /** ISO 8601 timestamp of when this batch was generated. */
  generatedAt: string
  userId: string | null
  username: string | null
  /** Skill dimension key, e.g. 'review-style'. Null for legacy records. */
  dimension: string | null
}
