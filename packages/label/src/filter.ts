import { generateObject } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import type { PrComment, FilterResult } from './types.js'

const FILTER_SYSTEM_PROMPT = `You are an expert code reviewer analyst. Your job is to evaluate whether a PR review comment is a relevant, clear, actionable, and categorizable recommendation.

A comment is relevant if it:
- Points out a real issue (bug, performance, security, readability, maintainability, design)
- Suggests a concrete improvement or alternative approach
- Is specific enough that the reviewee can act on it

A comment is NOT relevant if it:
- Is just a short acknowledgment ("ok", "lgtm", "nice", "thanks")
- Is a vague or unclear remark ("I don't understand", "hmm", "not sure about this")
- Is a question without any implied suggestion
- Is purely stylistic nitpicking with no real impact
- Is a conversation/discussion message rather than an actionable recommendation`

const RelevanceSchema = z.object({
  is_relevant: z.boolean().describe(
    'True if the comment is a clear, actionable, categorizable recommendation.'
  ),
})

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function buildFilterPrompt(comment: PrComment): string {
  return `Analyze this PR review comment and determine if it is a relevant, actionable recommendation.

## File
${comment.path}

## Diff hunk (context around the comment)
\`\`\`
${comment.diffHunk}
\`\`\`

## Comment
Author: ${comment.username}
${comment.body}`
}

export interface FilterOptions {
  model?: string
  limit?: number
  apiKey?: string
  onProgress?: (done: number, total: number) => void
}

export async function filterComments(
  comments: PrComment[],
  options?: FilterOptions,
): Promise<FilterResult> {
  const modelId = options?.model ?? 'claude-sonnet-4-6'
  const provider = createAnthropic({ apiKey: options?.apiKey })
  const sliced = options?.limit != null ? comments.slice(0, options.limit) : comments
  const total = sliced.length

  let skippedPreFilter = 0
  let skippedByLlm = 0
  const relevant: PrComment[] = []
  let done = 0

  for (const comment of sliced) {
    if (comment.inReplyToId != null || wordCount(comment.body) < 5) {
      skippedPreFilter++
      done++
      options?.onProgress?.(done, total)
      continue
    }

    const { object } = await generateObject({
      model: provider(modelId),
      schema: RelevanceSchema,
      system: FILTER_SYSTEM_PROMPT,
      prompt: buildFilterPrompt(comment),
    })

    if (object.is_relevant) {
      relevant.push(comment)
    } else {
      skippedByLlm++
    }

    done++
    options?.onProgress?.(done, total)
  }

  return { relevant, skippedPreFilter, skippedByLlm, total }
}
