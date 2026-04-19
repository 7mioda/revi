import { generateObject } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import type { PrComment, Rule } from './types.js'

const RULES_SYSTEM_PROMPT = `You are an expert code review analyst. You analyze PR review comments and extract recurring review patterns into reusable rules.

A rule represents a recurring code review guideline. Each rule has:
- "name": a kebab-case identifier (e.g., "prefer-explicit-naming")
- "content": a clear, actionable description of the rule (1-3 sentences)

Your task: given a set of existing rules and a batch of new PR review comments, analyze each comment and either:
1. Associate it with an existing rule (no change needed - do not include it in your output)
2. Generalize/extend an existing rule to cover this comment (include the updated rule with the SAME name)
3. Create a new rule if no existing rule matches the comment's intent (include the new rule)

IMPORTANT:
- Only return rules that are NEW or MODIFIED. Do not return unchanged existing rules.
- Keep rules general enough to apply across codebases, not specific to one file or PR.
- A rule should capture a principle or pattern, not a one-off suggestion.
- Use kebab-case for rule names.
- Each rule's content should be 1-3 sentences, clear and actionable.`

const RulesUpdateSchema = z.object({
  rules: z.array(z.object({
    name: z.string().regex(/^[a-z][a-z0-9-]*$/),
    content: z.string().min(10),
  })).describe('Only NEW or MODIFIED rules. Do not return unchanged rules.'),
})

function formatRulesForPrompt(rules: Rule[]): string {
  if (rules.length === 0) return '(no rules yet)'
  return rules.map(r => `- **${r.name}**: ${r.content}`).join('\n')
}

function formatCommentForPrompt(comment: PrComment, index: number): string {
  const diffHunk = (comment.diffHunk ?? '').length > 500
    ? (comment.diffHunk ?? '').slice(0, 500) + '\n... (truncated)'
    : (comment.diffHunk ?? '')

  return `### Comment ${index}
- **File**: ${comment.path ?? 'unknown'}
- **Repository**: ${comment.repoOwner}/${comment.repoName}
- **Comment**: ${comment.body}
- **Code context**:
\`\`\`
${diffHunk}
\`\`\``
}

function buildRulesPrompt(
  currentRules: Rule[],
  batch: PrComment[],
  batchNum: number,
  totalBatches: number,
): string {
  const rulesText = formatRulesForPrompt(currentRules)
  const commentsText = batch
    .map((c, i) => formatCommentForPrompt(c, i + 1))
    .join('\n\n')

  return `## Current Rules (${currentRules.length} rules)

${rulesText}

## New PR Review Comments (batch ${batchNum}/${totalBatches})

${commentsText}

---

Analyze these comments and return only NEW or MODIFIED rules.`
}

function mergeRules(existing: Rule[], updates: Rule[]): Rule[] {
  const map = new Map(existing.map(r => [r.name, r]))
  for (const r of updates) map.set(r.name, r)
  return [...map.values()]
}

export interface GenerateRulesOptions {
  model?: string
  batchSize?: number
  seedRules?: Rule[]
  apiKey?: string
  onBatch?: (batchNum: number, total: number, rules: Rule[]) => void | Promise<void>
}

export async function generateRules(
  comments: PrComment[],
  options?: GenerateRulesOptions,
): Promise<Rule[]> {
  const modelId = options?.model ?? 'claude-sonnet-4-6'
  const batchSize = options?.batchSize ?? 10
  const provider = createAnthropic({ apiKey: options?.apiKey })

  let currentRules: Rule[] = options?.seedRules ? [...options.seedRules] : []
  const totalBatches = Math.ceil(comments.length / batchSize)

  for (let i = 0; i < comments.length; i += batchSize) {
    const batch = comments.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1

    try {
      const { object } = await generateObject({
        model: provider(modelId),
        schema: RulesUpdateSchema,
        system: RULES_SYSTEM_PROMPT,
        prompt: buildRulesPrompt(currentRules, batch, batchNum, totalBatches),
      })

      currentRules = mergeRules(currentRules, object.rules)
    } catch (err) {
      console.error(`Batch ${batchNum} failed, skipping:`, err)
    }

    await options?.onBatch?.(batchNum, totalBatches, currentRules)
  }

  return currentRules
}
