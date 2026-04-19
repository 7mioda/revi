import { filterComments } from './filter.js'
import { clusterComments } from './cluster.js'
import { generateRules } from './rules.js'
import type { PrComment, Rule, Category, FilterResult } from './types.js'

export { filterComments } from './filter.js'
export { clusterComments } from './cluster.js'
export { generateRules } from './rules.js'
export type { PrComment, Rule, Category, FilterResult } from './types.js'
export type { FilterOptions } from './filter.js'
export type { ClusterOptions } from './cluster.js'
export type { GenerateRulesOptions } from './rules.js'

export interface PipelineOptions {
  comments: PrComment[]
  seedRules?: Rule[]
  nTopics?: number
  filterLimit?: number
  batchSize?: number
  apiKey?: string
  onProgress?: (step: 'filter' | 'cluster' | 'rules', info: string) => void
}

export interface PipelineResult {
  filterResult: FilterResult
  categories: Category[]
  rules: Rule[]
}

export async function runPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const { comments, seedRules, nTopics, filterLimit, batchSize, apiKey, onProgress } = options

  onProgress?.('filter', `Filtering ${comments.length} comments...`)
  const filterResult = await filterComments(comments, {
    limit: filterLimit,
    apiKey,
    onProgress: (done, total) => onProgress?.('filter', `${done}/${total}`),
  })
  onProgress?.('filter', `Done — ${filterResult.relevant.length} relevant comments`)

  onProgress?.('cluster', `Clustering ${filterResult.relevant.length} comments...`)
  const categories = await clusterComments(filterResult.relevant, { nTopics, apiKey })
  onProgress?.('cluster', `Done — ${categories.length} categories`)

  onProgress?.('rules', `Generating rules from ${filterResult.relevant.length} comments...`)
  const rules = await generateRules(filterResult.relevant, {
    batchSize,
    seedRules,
    apiKey,
    onBatch: (batchNum, total) => onProgress?.('rules', `batch ${batchNum}/${total}`),
  })
  onProgress?.('rules', `Done — ${rules.length} rules`)

  return { filterResult, categories, rules }
}
