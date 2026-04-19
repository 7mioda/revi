export interface PreferenceEntity {
  id: string
  name: string
  /** One of the PreferenceDimension keys. */
  dimension: string
  content: string
  tags: string[]
  /** One-sentence LLM summary of how this preference evolved. Null if insufficient data. */
  evolution: string | null
  /** UUID shared by all preferences generated in the same batch. */
  batchId: string
  /** ISO 8601 timestamp of when this batch was generated. */
  generatedAt: string
  userId: string | null
  username: string | null
}
